import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import {
  SellerEvents,
  SellerShopProfileChangeRequestedEvent,
  SellerShopProfileChangeReviewedEvent,
} from "@common/kafka/events";
import { ShopProfileChangeRequestNotificationPolicy } from "../../modules/notifications/policies/shop-profile-change-request-notification.policy";
import { NotificationsService } from "../../modules/notifications/services/notifications.service";

@Controller()
export class ShopProfileChangeRequestConsumer {
  private readonly logger = new Logger(ShopProfileChangeRequestConsumer.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly policy: ShopProfileChangeRequestNotificationPolicy,
  ) {}

  // Lưu notification vào MongoDB trước; NotificationsService chỉ phát Redis realtime sau khi bản ghi bền vững đã tạo thành công.
  @EventPattern(SellerEvents.SHOP_PROFILE_CHANGE_REQUESTED)
  async handleRequested(
    @Payload() event: SellerShopProfileChangeRequestedEvent,
  ): Promise<void> {
    this.logger.log(
      `Received shop profile change request event ${event.eventId}`,
    );
    await this.notifications.createFromEvent(this.policy.buildRequested(event));
  }

  // Lưu kết quả duyệt cho đúng requester rồi NotificationsService mới phát Redis realtime sau khi MongoDB ghi thành công.
  @EventPattern(SellerEvents.SHOP_PROFILE_CHANGE_APPROVED)
  async handleApproved(
    @Payload() event: SellerShopProfileChangeReviewedEvent,
  ): Promise<void> {
    this.logger.log(
      `Received approved shop profile change event ${event.eventId}`,
    );
    await this.notifications.createFromEvent(this.policy.buildApproved(event));
  }

  // Lưu phản hồi từ chối bền vững để seller vẫn đọc được sau khi offline hoặc tải lại Seller Center.
  @EventPattern(SellerEvents.SHOP_PROFILE_CHANGE_REJECTED)
  async handleRejected(
    @Payload() event: SellerShopProfileChangeReviewedEvent,
  ): Promise<void> {
    this.logger.log(
      `Received rejected shop profile change event ${event.eventId}`,
    );
    await this.notifications.createFromEvent(this.policy.buildRejected(event));
  }
}
