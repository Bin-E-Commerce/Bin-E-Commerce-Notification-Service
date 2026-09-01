// Consumer nay nhan review.created va luu notification in-app cho seller so seller theo doi phan hoi moi.
import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { ReviewCreatedEvent, ReviewEvents, ReviewUpdatedEvent } from "@common/kafka/events";
import { ReviewNotificationPolicy } from "../../modules/notifications/policies/review/review-notification.policy";
import { NotificationsService } from "../../modules/notifications/services/notifications.service";

@Controller()
export class ReviewConsumer {
  private readonly logger = new Logger(ReviewConsumer.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly policy: ReviewNotificationPolicy,
  ) {}

  // Notification duoc luu idempotent theo eventId de Kafka redelivery khong tao thong bao trung.
  @EventPattern(ReviewEvents.CREATED)
  async handleCreated(@Payload() event: ReviewCreatedEvent): Promise<void> {
    this.logger.log(`Received review event ${event.eventId}`);
    await this.createSellerNotification(event);
  }

  // Nhận event chỉnh sửa review để Seller biết nội dung hoặc số sao vừa thay đổi.
  @EventPattern(ReviewEvents.UPDATED)
  async handleUpdated(@Payload() event: ReviewUpdatedEvent): Promise<void> {
    this.logger.log(`Received updated review event ${event.eventId}`);
    await this.createSellerNotification(event);
  }

  // Dùng chung luồng persist để cả hai event đều được deduplicate theo eventId.
  private async createSellerNotification(
    event: ReviewCreatedEvent | ReviewUpdatedEvent,
  ): Promise<void> {
    await this.notifications.createFromEvent(this.policy.buildForSeller(event));
  }
}
