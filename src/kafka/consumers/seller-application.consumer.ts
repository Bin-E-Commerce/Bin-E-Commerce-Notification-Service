import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import {
  SellerEvents,
  SellerApplicationReviewedEvent,
  SellerApplicationSubmittedEvent,
} from "@common/kafka/events";
import { EmailService } from "../../modules/email/application/services/email.service";
import { SellerApplicationNotificationPolicy } from "../../modules/notifications/application/policies/seller/seller-application-notification.policy";
import { NotificationsService } from "../../modules/notifications/application/services/notifications.service";

// Consumer nhận event hồ sơ seller đã gửi duyệt để gửi email xác nhận cho người dùng.
@Controller()
export class SellerApplicationConsumer {
  private readonly logger = new Logger(SellerApplicationConsumer.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly notifications: NotificationsService,
    private readonly policy: SellerApplicationNotificationPolicy,
  ) {}

  // Khi seller-service publish event, notification-service gửi email "đang chờ duyệt" cho user.
  @EventPattern(SellerEvents.APPLICATION_SUBMITTED)
  async handleSellerApplicationSubmitted(
    @Payload() event: SellerApplicationSubmittedEvent,
  ): Promise<void> {
    this.logger.log(
      `Received seller application submitted event ${event.eventId}`,
    );

    // Mongo được ghi trước Redis realtime; nếu Socket đang ngắt, admin vẫn tải lại được notification từ REST.
    await this.notifications.createFromEvent(this.policy.buildSubmitted(event));

    try {
      await this.emailService.sendSellerApplicationSubmittedEmail(
        event.data.email,
        event.data.shopName,
        event.data.applicationId,
        event.data.submittedAt,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send seller application email to ${event.data.email}: ${String(
          err,
        )}`,
      );
    }
  }

  // Nhận kết quả từ chối và gửi lý do cụ thể để seller có đủ thông tin chỉnh sửa, thay vì chỉ thấy một trạng thái chung chung.
  @EventPattern(SellerEvents.APPLICATION_REJECTED)
  async handleSellerApplicationRejected(
    @Payload() event: SellerApplicationReviewedEvent,
  ): Promise<void> {
    this.logger.log(
      `Received seller application rejected event ${event.eventId}`,
    );

    await this.notifications.createFromEvent(this.policy.buildRejected(event));

    try {
      await this.emailService.sendSellerApplicationRejectedEmail(
        event.data.email,
        event.data.shopName,
        event.data.applicationId,
        event.data.reviewedAt,
        event.data.reviewNote ??
          "Vui lòng kiểm tra và bổ sung lại thông tin hồ sơ.",
        event.data.correctionTargets ?? [],
      );
    } catch (err) {
      this.logger.error(
        `Failed to send seller rejection email to ${event.data.email}: ${String(
          err,
        )}`,
      );
    }
  }

  // Lưu thông báo duyệt thành công trước khi gửi email để seller vẫn thấy kết quả trong ứng dụng nếu SMTP tạm lỗi.
  @EventPattern(SellerEvents.APPLICATION_APPROVED)
  async handleSellerApplicationApproved(
    @Payload() event: SellerApplicationReviewedEvent,
  ): Promise<void> {
    this.logger.log(
      `Received seller application approved event ${event.eventId}`,
    );

    await this.notifications.createFromEvent(this.policy.buildApproved(event));

    try {
      await this.emailService.sendSellerApplicationApprovedEmail(
        event.data.email,
        event.data.shopName,
        event.data.applicationId,
        event.data.reviewedAt,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send seller approval email to ${event.data.email}: ${String(
          err,
        )}`,
      );
    }
  }
}
