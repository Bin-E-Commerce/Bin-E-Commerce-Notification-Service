// Consumer nhận event hoàn tiền đã commit, tra email theo customer ID và xếp thư vào outbox có idempotency.
// Consumer không đọc dữ liệu ngân hàng và không gửi SMTP trực tiếp trong vòng xử lý Kafka.

import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { OrderEvents, type RefundCompletedEvent } from '@common/kafka/events';
import { AuthUserEmailClient } from '@/integrations/auth-user-email.client';
import { EmailDeliveryService } from '@/modules/email/application/services/email-delivery.service';

@Controller()
export class RefundCompletedConsumer {
    private readonly logger = new Logger(RefundCompletedConsumer.name);

    constructor(
        private readonly emailDelivery: EmailDeliveryService,
        private readonly userEmailClient: AuthUserEmailClient,
    ) {}

    // Mỗi event chỉ nhắm đến customerUserId trong Order Service snapshot; email retry tách khỏi Kafka consumer.
    @EventPattern(OrderEvents.REFUND_COMPLETED)
    async handleCompleted(
        @Payload() event: RefundCompletedEvent,
    ): Promise<void> {
        this.logger.log(`Received refund completed event ${event.eventId}`);
        const email = await this.userEmailClient.getEmail(
            event.data.customerUserId,
        );
        if (!email) {
            this.logger.warn(
                `No email found for refund customer ${event.data.customerUserId}`,
            );
            return;
        }

        await this.emailDelivery.enqueueRefundCompleted(
            `${event.eventId}:email`,
            {
                to: email,
                orderNumber: event.data.orderNumber,
                refundAmount: event.data.refundAmount,
                occurredAt: event.occurredAt,
                orderUrl: `/profile/orders/${event.data.orderId}`,
            },
        );
    }
}
