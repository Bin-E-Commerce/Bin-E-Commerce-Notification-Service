//
// File này nhận shipment.status.updated và tạo notification/email cho hai audience.
// Notification được lưu trước; email lỗi chỉ được log để không làm Kafka retry vô hạn.
//

import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ShipmentStatusUpdatedEvent, ShippingEvents } from '@common/kafka/events';
import { AuthUserEmailClient } from '../../integrations/auth-user-email.client';
import { EmailService } from '../../modules/email/email.service';
import { ShipmentNotificationPolicy } from '../../modules/notifications/policies/shipment/shipment-notification.policy';
import { NotificationsService } from '../../modules/notifications/services/notifications.service';

@Controller()
export class ShipmentConsumer {
  private readonly logger = new Logger(ShipmentConsumer.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly policy: ShipmentNotificationPolicy,
    private readonly emailService: EmailService,
    private readonly userEmailClient: AuthUserEmailClient,
  ) {}

  // Xử lý hai recipient độc lập để seller email lỗi không ngăn customer nhận notification.
  @EventPattern(ShippingEvents.STATUS_UPDATED)
  async handle(@Payload() event: ShipmentStatusUpdatedEvent): Promise<void> {
    this.logger.log(`Received shipment event ${event.eventId}`);
    await this.notifyUser(event, this.policy.buildForCustomer(event), event.data.customerUserId, 'customer');
    await this.notifyUser(event, this.policy.buildForSeller(event), event.data.sellerUserId, 'seller');
  }

  // Deduplicate theo eventId trước khi resolve email và render template để retry Kafka không gửi mail trùng.
  private async notifyUser(
    event: ShipmentStatusUpdatedEvent,
    input: Parameters<NotificationsService['createFromEvent']>[0],
    userId: string,
    role: 'customer' | 'seller',
  ): Promise<void> {
    const result = await this.notifications.createFromEvent(input);
    if (!result.created) return;
    try {
      const email = await this.userEmailClient.getEmail(userId);
      if (!email) return;
      await this.emailService.sendShipmentStatusEmail({
        to: email,
        orderNumber: event.data.orderNumber,
        trackingCode: event.data.trackingCode,
        status: event.data.statusLabel,
        locationLabel: event.data.currentLocation.label,
        occurredAt: event.occurredAt,
        orderUrl: input.actionUrl ?? '/',
        role,
      });
    } catch (error) {
      this.logger.error(`Failed to send shipment email to ${userId}: ${String(error)}`);
    }
  }
}
