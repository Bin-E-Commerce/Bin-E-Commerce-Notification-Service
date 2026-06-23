import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import {
  NotificationEvents,
  OtpRequestedPayload,
} from "@common/kafka/events";
import { EmailService } from "../../modules/email/email.service";

// Nhận OTP request từ Kafka và gửi email OTP tương ứng
@Controller()
export class OtpConsumer {
  private readonly logger = new Logger(OtpConsumer.name);

  constructor(private readonly emailService: EmailService) {}

  // Xử lý sự kiện OTP_REQUESTED được gửi từ Auth Service
  // Payload sẽ chứa email, OTP, mục đích sử dụng và thời gian hết hạn của OTP
  @EventPattern(NotificationEvents.OTP_REQUESTED)
  async handleOtpRequested(
    @Payload() payload: OtpRequestedPayload,
  ): Promise<void> {
    this.logger.log(
      `Received OTP request for ${payload.email} [purpose=${payload.purpose}]`,
    );

    try {
      await this.emailService.sendOtpEmail(
        payload.email,
        payload.otp,
        payload.purpose,
        payload.expiresIn,
      );
    } catch (err) {
      this.logger.error(
        `Failed to process OTP for ${payload.email}: ${String(err)}`,
      );
    }
  }
}
