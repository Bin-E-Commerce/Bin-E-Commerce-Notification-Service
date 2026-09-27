// Application service quản lý hàng đợi email shipment và retry SMTP độc lập với notification feed.
// Service này không quyết định nội dung email; EmailService vẫn sở hữu template và transport.

import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailService } from '@/modules/email/application/services/email.service';
import {
    EmailDelivery,
    EmailDeliveryDocument,
} from '@/modules/email/infrastructure/schemas/email-delivery.schema';

type ShipmentEmailInput = Parameters<
    EmailService['sendShipmentStatusEmail']
>[0];
type OrderCreatedEmailInput = Parameters<
    EmailService['sendOrderCreatedEmail']
>[0];
type OrderCancelledEmailInput = Parameters<
    EmailService['sendOrderCancelledEmail']
>[0];
type ReturnEmailInput = Parameters<EmailService['sendReturnStatusEmail']>[0];
type EmailDeliveryKind =
    'SHIPMENT_STATUS' | 'ORDER_CREATED' | 'ORDER_CANCELLED' | 'RETURN_STATUS';

// Gửi email shipment theo at-least-once delivery; dedupeKey ngăn cùng event/recipient tạo nhiều job.
@Injectable()
export class EmailDeliveryService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(EmailDeliveryService.name);
    private dispatchTimer?: NodeJS.Timeout;
    private dispatching = false;

    constructor(
        @InjectModel(EmailDelivery.name)
        private readonly model: Model<EmailDelivery>,
        private readonly emailService: EmailService,
    ) {}

    // Khởi động worker nền để xử lý job tồn từ lần chạy trước hoặc SMTP vừa phục hồi.
    onModuleInit(): void {
        this.dispatchTimer = setInterval(
            () => void this.dispatchPendingSafe(),
            5000,
        );
        void this.dispatchPendingSafe();
    }

    // Dừng timer khi service shutdown để không giữ process sống ngoài ý muốn.
    onModuleDestroy(): void {
        if (this.dispatchTimer) clearInterval(this.dispatchTimer);
    }

    // Upsert job theo event/recipient; replay Kafka chỉ tạo lại cùng một job chứ không gửi trùng.
    async enqueueShipmentStatus(
        dedupeKey: string,
        input: ShipmentEmailInput,
    ): Promise<void> {
        await this.enqueue(dedupeKey, 'SHIPMENT_STATUS', input);
    }

    // Đưa email tạo đơn vào cùng hàng đợi để SMTP lỗi không làm mất email sau khi order event đã được xử lý.
    async enqueueOrderCreated(
        dedupeKey: string,
        input: OrderCreatedEmailInput,
    ): Promise<void> {
        await this.enqueue(dedupeKey, 'ORDER_CREATED', input);
    }

    // Đưa email hủy đơn vào outbox với cùng cơ chế idempotency và retry như shipment email.
    async enqueueOrderCancelled(
        dedupeKey: string,
        input: OrderCancelledEmailInput,
    ): Promise<void> {
        await this.enqueue(dedupeKey, 'ORDER_CANCELLED', input);
    }

    // Đưa email hoàn hàng vào outbox để các trạng thái return cũng không bị mất khi SMTP tạm thời lỗi.
    async enqueueReturnStatus(
        dedupeKey: string,
        input: ReturnEmailInput,
    ): Promise<void> {
        await this.enqueue(dedupeKey, 'RETURN_STATUS', input);
    }

    // Upsert payload snapshot dùng chung cho mọi loại email nghiệp vụ có thể retry.
    private async enqueue(
        dedupeKey: string,
        kind: EmailDeliveryKind,
        input:
            | ShipmentEmailInput
            | OrderCreatedEmailInput
            | OrderCancelledEmailInput
            | ReturnEmailInput,
    ): Promise<void> {
        await this.model.updateOne(
            { dedupeKey },
            {
                $setOnInsert: {
                    dedupeKey,
                    kind,
                    to: input.to,
                    payload: { ...input, to: undefined },
                    status: 'PENDING',
                    attemptCount: 0,
                    availableAt: new Date(),
                    sentAt: null,
                    lastError: null,
                },
            },
            { upsert: true },
        );
        void this.dispatchPendingSafe();
    }

    // Claim tuần tự tối đa 20 job để giới hạn tải SMTP và tránh hai worker xử lý cùng một bản ghi.
    private async dispatchPending(): Promise<void> {
        for (let index = 0; index < 20; index += 1) {
            const job = await this.claimNext();
            if (!job) return;

            try {
                await this.send(job);
                await this.model.updateOne(
                    { _id: job._id, status: 'PROCESSING' },
                    {
                        $set: {
                            status: 'SENT',
                            sentAt: new Date(),
                            lastError: null,
                        },
                    },
                );
            } catch (error) {
                const attemptCount = job.attemptCount + 1;
                const delaySeconds = Math.min(
                    3600,
                    2 ** Math.min(attemptCount, 10),
                );
                await this.model.updateOne(
                    { _id: job._id, status: 'PROCESSING' },
                    {
                        $set: {
                            status: 'PENDING',
                            attemptCount,
                            availableAt: new Date(
                                Date.now() + delaySeconds * 1000,
                            ),
                            lastError:
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                        },
                    },
                );
            }
        }
    }

    // Thu hồi job PROCESSING bị bỏ dở sau crash rồi claim atomically bằng một update Mongo.
    private async claimNext(): Promise<EmailDeliveryDocument | null> {
        const now = new Date();
        const staleBefore = new Date(Date.now() - 60_000);
        return this.model
            .findOneAndUpdate(
                {
                    $or: [
                        { status: 'PENDING', availableAt: { $lte: now } },
                        {
                            status: 'PROCESSING',
                            updatedAt: { $lt: staleBefore },
                        },
                    ],
                },
                { $set: { status: 'PROCESSING', updatedAt: now } },
                { sort: { createdAt: 1 }, new: true },
            )
            .exec();
    }

    // Chọn template tương ứng và giữ nguyên payload snapshot đã tạo từ event.
    private async send(job: EmailDeliveryDocument): Promise<void> {
        const payload = job.payload as Record<string, unknown>;
        switch (job.kind) {
            case 'SHIPMENT_STATUS':
                await this.emailService.sendShipmentStatusEmail({
                    ...(payload as Omit<ShipmentEmailInput, 'to'>),
                    to: job.to,
                });
                return;
            case 'ORDER_CREATED':
                await this.emailService.sendOrderCreatedEmail({
                    ...(payload as Omit<OrderCreatedEmailInput, 'to'>),
                    to: job.to,
                });
                return;
            case 'ORDER_CANCELLED':
                await this.emailService.sendOrderCancelledEmail({
                    ...(payload as Omit<OrderCancelledEmailInput, 'to'>),
                    to: job.to,
                });
                return;
            case 'RETURN_STATUS':
                await this.emailService.sendReturnStatusEmail({
                    ...(payload as Omit<ReturnEmailInput, 'to'>),
                    to: job.to,
                });
                return;
        }
    }

    // Chặn worker chồng lấn và giữ job trong Mongo nếu lỗi kết nối database/hạ tầng xảy ra.
    private async dispatchPendingSafe(): Promise<void> {
        if (this.dispatching) return;
        this.dispatching = true;
        try {
            await this.dispatchPending();
        } catch (error) {
            this.logger.warn(
                `Email delivery worker deferred: ${error instanceof Error ? error.message : String(error)}`,
            );
        } finally {
            this.dispatching = false;
        }
    }
}
