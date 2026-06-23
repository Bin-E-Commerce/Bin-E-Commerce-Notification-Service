import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>("SMTP_HOST", "smtp.gmail.com");
    const port = this.config.get<number>("SMTP_PORT", 587);
    const user = this.config.get<string>("SMTP_USER", "");
    const pass = this.config.get<string>("SMTP_PASSWORD", "");

    this.from = `"Bin E-Commerce" <${user}>`;

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
    const purposeLabel =
      purpose === "REGISTER"
        ? "xac nhan dang ky"
        : purpose === "RESET_PASSWORD"
          ? "dat lai mat khau"
          : "xac thuc";

    const expiresMinutes = Math.floor(expiresIn / 60);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #111827; margin-bottom: 8px;">Ma xac thuc Bin E-Commerce</h2>
        <p style="color: #6b7280; margin-bottom: 24px;">
          Day la ma OTP de ${purposeLabel} tai khoan cua ban:
        </p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #111827;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          Ma co hieu luc trong <strong>${expiresMinutes} phut</strong>. Khong chia se ma nay voi bat ky ai.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          Neu ban khong yeu cau ma nay, hay bo qua email nay.
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: `[Bin] Ma OTP ${purposeLabel}: ${otp}`,
        html,
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
  ): Promise<void> {
    const safeShopName = this.escapeHtml(shopName);
    const safeApplicationId = this.escapeHtml(applicationId);
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 10px;">
        <h2 style="color: #111827; margin: 0 0 8px;">Ho so nguoi ban da duoc gui</h2>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px;">
          Cam on ban da dang ky mo shop <strong>${safeShopName}</strong> tren Bin E-Commerce.
          Ho so cua ban dang cho doi ngu van hanh kiem tra.
        </p>
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">Ma ho so</p>
          <p style="margin: 6px 0 0; color: #111827; font-weight: 700;">${safeApplicationId}</p>
        </div>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
          Ban se nhan thong bao tiep theo khi ho so duoc duyet hoac can bo sung thong tin.
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: `[Bin] Ho so nguoi ban cua ${shopName} dang cho duyet`,
        html,
      });
      this.logger.log(`Seller application email sent to ${to}`);
    } catch (err) {
      this.logger.error(
        `Failed to send seller application email to ${to}: ${String(err)}`,
      );
      throw err;
    }
  }

  // Escape dữ liệu do người dùng nhập trước khi nhúng vào HTML email.
  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}
