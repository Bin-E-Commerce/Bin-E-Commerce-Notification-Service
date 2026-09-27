//
// File này nhận shipment.status.updated và tạo notification/email cho hai audience.
// Notification được lưu trước; email lỗi chỉ được log để không làm Kafka retry vô hạn.
//

import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
    ShipmentStatusUpdatedEvent,
    ShippingEvents,
} from '@common/kafka/events';
import { AuthUserEmailClient } from '@/integrations/auth-user-email.client';
import { EmailDeliveryService } from '@/modules/email/application/services/email-delivery.service';
import { ShipmentNotificationPolicy } from '@/modules/notifications/application/policies/shipment/shipment-notification.policy';
import { NotificationsService } from '@/modules/notifications/application/services/notifications.service';

@Controller()
export class ShipmentConsumer {
    private readonly logger = new Logger(ShipmentConsumer.name);

    constructor(
        private readonly notifications: NotificationsService,
        private readonly policy: ShipmentNotificationPolicy,
        private readonly emailDelivery: EmailDeliveryService,
        private readonly userEmailClient: AuthUserEmailClient,
    ) {}

    // Xử lý hai recipient độc lập để seller email lỗi không ngăn customer nhận notification.
    @EventPattern(ShippingEvents.STATUS_UPDATED)
    async handle(@Payload() event: ShipmentStatusUpdatedEvent): Promise<void> {
        this.logger.log(`Received shipment event ${event.eventId}`);
        await this.notifyUser(
            event,
            this.policy.buildForCustomer(event),
            event.data.customerUserId,
            'customer',
        );
        await this.notifyUser(
            event,
            this.policy.buildForSeller(event),
            event.data.sellerUserId,
            'seller',
        );
    }

    // Notification có thể đã tồn tại từ lần nhận trước; email vẫn luôn được upsert vào outbox riêng.
    // Nếu auth hoặc Mongo lỗi thì ném lỗi để Kafka redelivery, còn SMTP được worker retry độc lập.
    private async notifyUser(
        event: ShipmentStatusUpdatedEvent,
        input: Parameters<NotificationsService['createFromEvent']>[0],
        userId: string,
        role: 'customer' | 'seller',
    ): Promise<void> {
        await this.notifications.createFromEvent(input);
        const email = await this.userEmailClient.getEmail(userId);
        if (!email) {
            this.logger.warn(
                `No email found for shipment notification user ${userId}`,
            );
            return;
        }

        await this.emailDelivery.enqueueShipmentStatus(
            `${event.eventId}:${role}:${userId}`,
            {
                to: email,
                orderNumber: event.data.orderNumber,
                trackingCode: event.data.trackingCode,
                status: event.data.statusLabel,
                locationLabel: event.data.currentLocation.label,
                occurredAt: event.occurredAt,
                orderUrl: input.actionUrl ?? '/',
                role,
            },
        );
    }
}
