import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import {
  SellerEvents,
  SellerApplicationReviewedPayload,
  SellerApplicationSubmittedPayload,
} from "@common/kafka/events";
import { EmailService } from "../../modules/email/email.service";

// Consumer nhận event hồ sơ seller đã gửi duyệt để gửi email xác nhận cho người dùng.
@Controller()
export class SellerApplicationConsumer {
  private readonly logger = new Logger(SellerApplicationConsumer.name);

  constructor(private readonly emailService: EmailService) {}

  // Khi seller-service publish event, notification-service gửi email "đang chờ duyệt" cho user.
  @EventPattern(SellerEvents.APPLICATION_SUBMITTED)
  async handleSellerApplicationSubmitted(
    @Payload() payload: SellerApplicationSubmittedPayload,
  ): Promise<void> {
    this.logger.log(
      `Received seller application submitted event for ${payload.email}`,
    );

    try {
      await this.emailService.sendSellerApplicationSubmittedEmail(
        payload.email,
        payload.shopName,
        payload.applicationId,
        payload.submittedAt,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send seller application email to ${payload.email}: ${String(
          err,
        )}`,
      );
    }
  }

  // Nhận kết quả từ chối và gửi lý do cụ thể để seller có đủ thông tin chỉnh sửa, thay vì chỉ thấy một trạng thái chung chung.
  @EventPattern(SellerEvents.APPLICATION_REJECTED)
  async handleSellerApplicationRejected(
    @Payload() payload: SellerApplicationReviewedPayload,
  ): Promise<void> {
    this.logger.log(
      `Received seller application rejected event for ${payload.email}`,
    );

    try {
      await this.emailService.sendSellerApplicationRejectedEmail(
        payload.email,
        payload.shopName,
        payload.applicationId,
        payload.reviewedAt,
        payload.reviewNote ?? "Vui lòng kiểm tra và bổ sung lại thông tin hồ sơ.",
        payload.correctionTargets ?? [],
      );
    } catch (err) {
      this.logger.error(
        `Failed to send seller rejection email to ${payload.email}: ${String(
          err,
        )}`,
      );
    }
  }
}
