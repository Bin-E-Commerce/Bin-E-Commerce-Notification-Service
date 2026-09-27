// File này nhận event order.created/order.cancelled, lưu in-app notification và gửi email cho đúng audience.
// Notification được ghi trước; email là side effect độc lập nên SMTP lỗi không làm mất thông báo trong ứng dụng.

import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
    OrderCancelledEvent,
    OrderCreatedEvent,
    OrderEvents,
} from '@common/kafka/events';
import { AuthUserEmailClient } from '@/integrations/auth-user-email.client';
import { EmailDeliveryService } from '@/modules/email/application/services/email-delivery.service';
import type { EmailService } from '@/modules/email/application/services/email.service';
import { OrderNotificationPolicy } from '@/modules/notifications/application/policies/order/order-notification.policy';
import { NotificationsService } from '@/modules/notifications/application/services/notifications.service';
import type { CreateNotificationInput } from '@/modules/notifications/application/types/create-notification-input.type';

type OrderCreatedEmailInput = Omit<
    Parameters<EmailService['sendOrderCreatedEmail']>[0],
    'to'
>;
type OrderCancelledEmailInput = Omit<
    Parameters<EmailService['sendOrderCancelledEmail']>[0],
    'to'
>;

@Controller()
export class OrderConsumer {
    private readonly logger = new Logger(OrderConsumer.name);

    constructor(
        private readonly notifications: NotificationsService,
        private readonly policy: OrderNotificationPolicy,
        private readonly emailDelivery: EmailDeliveryService,
        private readonly userEmailClient: AuthUserEmailClient,
    ) {}

    // Tạo notification/email cho customer và từng seller sau khi order COD được commit thành công.
    @EventPattern(OrderEvents.CREATED)
    async handleCreated(@Payload() event: OrderCreatedEvent): Promise<void> {
        this.logger.log(`Received order created event ${event.eventId}`);

        // Event cũ chỉ có seller recipients; bỏ qua customer branch để replay message cũ không tạo audience rỗng.
        if (event.data.customerUserId) {
            await this.createNotificationAndEmail(
                this.policy.buildCreatedForCustomer(event),
                event.data.customerUserId,
                {
                    orderNumber: event.data.orderNumber,
                    role: 'customer',
                    orderUrl: `/profile/orders/${event.data.orderId}`,
                    createdAt: event.data.createdAt,
                    totalAmount: event.data.totalAmount,
                    items: event.data.customerItems,
                },
                event.data.customerEmail,
            );
        }

        for (const recipient of event.data.recipients) {
            await this.createNotificationAndEmail(
                this.policy.buildCreatedForSeller(event, recipient),
                recipient.userId,
                {
                    orderNumber: event.data.orderNumber,
                    role: 'seller',
                    orderUrl: `/seller/orders/${event.data.orderId}`,
                    createdAt: event.data.createdAt,
                    totalAmount: event.data.totalAmount,
                    itemCount: recipient.itemCount,
                    shopItemTotal: recipient.shopItemTotal,
                },
            );
        }
    }

    // Tạo notification/email khi order chuyển sang CANCELLED; eventId recipient giúp retry không gửi trùng.
    @EventPattern(OrderEvents.CANCELLED)
    async handleCancelled(
        @Payload() event: OrderCancelledEvent,
    ): Promise<void> {
        this.logger.log(`Received order cancelled event ${event.eventId}`);

        await this.createNotificationAndEmail(
            this.policy.buildCancelledForCustomer(event),
            event.data.customerUserId,
            {
                orderNumber: event.data.orderNumber,
                role: 'customer',
                orderUrl: `/profile/orders/${event.data.orderId}`,
                createdAt: event.data.createdAt,
                totalAmount: event.data.totalAmount,
                cancelledAt: event.data.cancelledAt,
                cancelReason: event.data.cancelReason,
                items: event.data.customerItems,
            },
            event.data.customerEmail,
        );

        for (const recipient of event.data.recipients) {
            await this.createNotificationAndEmail(
                this.policy.buildCancelledForSeller(event, recipient),
                recipient.userId,
                {
                    orderNumber: event.data.orderNumber,
                    role: 'seller',
                    orderUrl: `/seller/orders/${event.data.orderId}`,
                    createdAt: event.data.createdAt,
                    totalAmount: event.data.totalAmount,
                    cancelledAt: event.data.cancelledAt,
                    cancelReason: event.data.cancelReason,
                    itemCount: recipient.itemCount,
                    shopItemTotal: recipient.shopItemTotal,
                },
            );
        }
    }

    // Notification có thể đã tồn tại từ lần nhận trước; email được upsert vào outbox riêng để SMTP có thể retry.
    private async createNotificationAndEmail(
        input: CreateNotificationInput,
        userId: string,
        emailInput: OrderCreatedEmailInput | OrderCancelledEmailInput,
        emailOverride?: string | null,
    ): Promise<void> {
        await this.notifications.createFromEvent(input);
        const email =
            emailOverride?.trim().toLowerCase() ||
            (await this.userEmailClient.getEmail(userId));
        if (!email) {
            this.logger.warn(
                `No email found for order notification user ${userId}`,
            );
            return;
        }

        const dedupeKey = `${input.eventId}:email`;
        if (input.type.includes('created')) {
            await this.emailDelivery.enqueueOrderCreated(dedupeKey, {
                ...emailInput,
                to: email,
            } as Parameters<EmailService['sendOrderCreatedEmail']>[0]);
            return;
        }

        await this.emailDelivery.enqueueOrderCancelled(dedupeKey, {
            ...emailInput,
            to: email,
        } as Parameters<EmailService['sendOrderCancelledEmail']>[0]);
    }
}
