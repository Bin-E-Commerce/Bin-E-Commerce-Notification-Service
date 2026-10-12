//
// File này nhận shipment.status.updated và tạo notification/email cho hai audience.
// Notification được lưu trước; email lỗi chỉ được log để không làm Kafka retry vô hạn.
//

import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
    type ShipmentStatus,
    type ShipmentStatusUpdatedEvent,
    ShippingEvents,
} from '@common/kafka/events';
import { AuthUserEmailClient } from '@/integrations/auth-user-email.client';
import { EmailDeliveryService } from '@/modules/email/application/services/email-delivery.service';
import { ShipmentNotificationPolicy } from '@/modules/notifications/application/policies/shipment/shipment-notification.policy';
import { NotificationsService } from '@/modules/notifications/application/services/notifications.service';

// Email chỉ dành cho mốc vận chuyển quan trọng; các cập nhật nhỏ vẫn nằm trong app.
const EMAIL_SHIPMENT_STATUSES = new Set<ShipmentStatus>([
    'PICKED_UP',
    'DELIVERED',
    'FAILED',
]);

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
        const sendEmail = this.shouldSendEmail(event);

        await this.notifyUser(
            event,
            this.policy.buildForCustomer(event),
            event.data.customerUserId,
            'customer',
            sendEmail,
        );
        await this.notifyUser(
            event,
            this.policy.buildForSeller(event),
            event.data.sellerUserId,
            'seller',
            sendEmail,
        );
    }

    // Bỏ email trạng thái trung gian và email vận đơn hoàn để tránh trùng với luồng return riêng.
    private shouldSendEmail(event: ShipmentStatusUpdatedEvent): boolean {
        if (
            event.data.shipmentKind === 'RETURN' ||
            Boolean(event.data.returnRequestId)
        ) {
            return false;
        }

        return EMAIL_SHIPMENT_STATUSES.has(event.data.status);
    }

    // Feed luôn nhận đủ trạng thái; các mốc không gửi email sẽ dừng trước khi tra email người dùng.
    // Nếu auth hoặc Mongo lỗi thì ném lỗi để Kafka redelivery, còn SMTP được worker retry độc lập.
    private async notifyUser(
        event: ShipmentStatusUpdatedEvent,
        input: Parameters<NotificationsService['createFromEvent']>[0],
        userId: string,
        role: 'customer' | 'seller',
        sendEmail: boolean,
    ): Promise<void> {
        await this.notifications.createFromEvent(input);
        // Ghi feed trước rồi mới lọc email để không làm mất cập nhật chi tiết trong ứng dụng.
        if (!sendEmail) return;

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
