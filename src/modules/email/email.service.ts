import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import * as nodemailer from "nodemailer";
import type { SendMailOptions, Transporter } from "nodemailer";
import { buildOtpTemplate } from "./templates/otp.template";
import { buildSellerApplicationSubmittedTemplate } from "./templates/seller-application-submitted.template";
import { buildSellerApplicationRejectedTemplate } from "./templates/seller-application-rejected.template";
import { buildSellerApplicationApprovedTemplate } from "./templates/seller-application-approved.template";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly webBaseUrl: string;
  private readonly logoPath: string;
  private readonly logoCid = "bin-ecommerce-logo";

  // Khởi tạo SMTP transport và cấu hình nhận diện email một lần khi notification-service khởi động.
  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>("SMTP_HOST", "smtp.gmail.com");
    const port = this.config.get<number>("SMTP_PORT", 587);
    const user = this.config.get<string>("SMTP_USER", "");
    const pass = this.config.get<string>("SMTP_PASSWORD", "");

    const fromAddress = this.config.get<string>("SMTP_FROM", user);

    this.from = `"Bin E-Commerce" <${fromAddress}>`;
    this.webBaseUrl = this.config.get<string>(
      "WEB_BASE_URL",
      "http://localhost:5173",
    );
    this.logoPath = resolve(
      this.config.get<string>(
        "EMAIL_LOGO_PATH",
        resolve(process.cwd(), "assets/email/bin-logo.png"),
      ),
    );

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  // Gửi email OTP với nội dung được tùy chỉnh theo mục đích sử dụng (đăng ký, đặt lại mật khẩu, xác thực)
  async sendOtpEmail(
    to: string,
    otp: string,
    purpose: string,
    expiresIn: number,
  ): Promise<void> {
    const expiresMinutes = Math.max(1, Math.ceil(expiresIn / 60));
    const attachments = this.buildBrandAttachments();
    const template = buildOtpTemplate({
      otp,
      purpose,
      expiresMinutes,
      logoCid: attachments.length > 0 ? this.logoCid : undefined,
    });

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        attachments,
      });
      this.logger.log(`OTP email sent to ${to} [purpose=${purpose}]`);
    } catch (err) {
      this.logger.error(`Failed to send OTP email to ${to}: ${String(err)}`);
      throw err;
    }
  }

  // Gửi email xác nhận hồ sơ người bán đã được gửi và đang chờ đội ngũ vận hành duyệt.
  async sendSellerApplicationSubmittedEmail(
    to: string,
    shopName: string,
    applicationId: string,
    submittedAt: string,
  ): Promise<void> {
    const attachments = this.buildBrandAttachments();
    const template = buildSellerApplicationSubmittedTemplate({
      shopName,
      applicationId,
      submittedAt,
      webBaseUrl: this.webBaseUrl,
      logoCid: attachments.length > 0 ? this.logoCid : undefined,
    });

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        attachments,
      });
      this.logger.log(`Seller application email sent to ${to}`);
    } catch (err) {
      this.logger.error(
        `Failed to send seller application email to ${to}: ${String(err)}`,
      );
      throw err;
    }
  }

  // Gửi lý do hồ sơ chưa đạt và đường dẫn quay lại onboarding để seller có thể sửa dữ liệu rồi gửi duyệt lần nữa.
  async sendSellerApplicationRejectedEmail(
    to: string,
    shopName: string,
    applicationId: string,
    reviewedAt: string,
    reviewNote: string,
    correctionTargets: string[],
  ): Promise<void> {
    // Đảm bảo URL an toàn và không bị tiêm mã độc vào email.
    const attachments = this.buildBrandAttachments();

    // Chuyển đổi các giá trị đầu vào thành định dạng an toàn để tránh tiêm mã độc vào email.
    const template = buildSellerApplicationRejectedTemplate({
      shopName,
      applicationId,
      reviewedAt,
      reviewNote,
      correctionTargets,
      webBaseUrl: this.webBaseUrl,
      logoCid: attachments.length > 0 ? this.logoCid : undefined,
    });

    // Gửi email với nội dung đã được xây dựng từ template.
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        attachments,
      });
      this.logger.log(`Seller rejection email sent to ${to}`);
    } catch (err) {
      this.logger.error(
        `Failed to send seller rejection email to ${to}: ${String(err)}`,
      );
      throw err;
    }
  }

  // Gửi xác nhận hồ sơ đã được duyệt và dẫn người dùng vào Seller Center bằng email có nhận diện thương hiệu.
  async sendSellerApplicationApprovedEmail(
    to: string,
    shopName: string,
    applicationId: string,
    reviewedAt: string,
  ): Promise<void> {
    const attachments = this.buildBrandAttachments();
    const template = buildSellerApplicationApprovedTemplate({
      shopName,
      applicationId,
      reviewedAt,
      webBaseUrl: this.webBaseUrl,
      logoCid: attachments.length > 0 ? this.logoCid : undefined,
    });

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        attachments,
      });
      this.logger.log(`Seller approval email sent to ${to}`);
    } catch (err) {
      this.logger.error(
        `Failed to send seller approval email to ${to}: ${String(err)}`,
      );
      throw err;
    }
  }

  // Gắn logo bằng CID để email client hiển thị ảnh nội tuyến mà không cần truy cập web hoặc CDN bên ngoài.
  private buildBrandAttachments(): NonNullable<SendMailOptions["attachments"]> {
    if (!existsSync(this.logoPath)) {
      this.logger.warn(
        `Email logo not found at ${this.logoPath}; using text brand fallback`,
      );
      return [];
    }

    return [
      {
        filename: "bin-ecommerce-logo.png",
        path: this.logoPath,
        cid: this.logoCid,
        contentDisposition: "inline",
      },
    ];
  }
}
