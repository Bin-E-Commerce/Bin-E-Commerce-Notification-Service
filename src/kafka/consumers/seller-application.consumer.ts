import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import {
  SellerEvents,
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
      );
    } catch (err) {
      this.logger.error(
        `Failed to send seller application email to ${payload.email}: ${String(
          err,
        )}`,
      );
    }
  }
}
