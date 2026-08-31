// Service này quản lý SMTP transport, branding và việc gửi các template email của hệ thống.
// Nó không tự quyết định audience; consumer phải truyền recipient đã được xác định từ event nghiệp vụ.

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import * as nodemailer from "nodemailer";
import type { SendMailOptions, Transporter } from "nodemailer";
import { buildOtpTemplate } from "./templates/auth/otp.template";
import { buildSellerApplicationSubmittedTemplate } from "./templates/seller-applications/seller-application-submitted.template";
import { buildSellerApplicationRejectedTemplate } from "./templates/seller-applications/seller-application-rejected.template";
import { buildSellerApplicationApprovedTemplate } from "./templates/seller-applications/seller-application-approved.template";
import {
  buildOrderCancelledTemplate,
  buildOrderCreatedTemplate,
  type OrderEmailItem,
  type OrderEmailRole,
} from "./templates/orders/order.template";
import { buildShipmentStatusTemplate, type ShipmentEmailRole } from "./templates/shipments/shipment.template";

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
        resolve(process.cwd(), "assets/email/logo_background_white.png"),
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

  // Gửi email order mới cho customer hoặc seller; nội dung được chọn theo role nhưng dùng chung transport và branding.
  async sendOrderCreatedEmail(input: {
    to: string;
    orderNumber: string;
    role: OrderEmailRole;
    orderUrl: string;
    totalAmount: string;
    createdAt: string;
    itemCount?: number;
    shopItemTotal?: string;
    items?: OrderEmailItem[];
  }): Promise<void> {
    const attachments = this.buildBrandAttachments();
    const template = buildOrderCreatedTemplate({
      ...input,
      orderUrl: this.toWebUrl(input.orderUrl),
      webBaseUrl: this.webBaseUrl,
      logoCid: attachments.length > 0 ? this.logoCid : undefined,
    });
    await this.sendTemplateEmail(input.to, template, "order created", attachments);
  }

  // Gửi email hủy đơn cho customer hoặc seller và giữ nguyên lý do snapshot từ Order Service.
  async sendOrderCancelledEmail(input: {
    to: string;
    orderNumber: string;
    role: OrderEmailRole;
    orderUrl: string;
    totalAmount: string;
    createdAt: string;
    cancelledAt: string;
    cancelReason: string | null;
    itemCount?: number;
    shopItemTotal?: string;
    items?: OrderEmailItem[];
  }): Promise<void> {
    const attachments = this.buildBrandAttachments();
    const template = buildOrderCancelledTemplate({
      ...input,
      orderUrl: this.toWebUrl(input.orderUrl),
      webBaseUrl: this.webBaseUrl,
      logoCid: attachments.length > 0 ? this.logoCid : undefined,
    });
    await this.sendTemplateEmail(input.to, template, "order cancelled", attachments);
  }

  // Gửi email cho từng mốc shipment bằng snapshot event, không truy vấn lại Order Service trong email path.
  async sendShipmentStatusEmail(input: {
    to: string;
    orderNumber: string;
    trackingCode: string;
    status: string;
    locationLabel: string;
    occurredAt: string;
    orderUrl: string;
    role: ShipmentEmailRole;
  }): Promise<void> {
    const attachments = this.buildBrandAttachments();
    const template = buildShipmentStatusTemplate({
      ...input,
      orderNumber: input.orderNumber,
      statusLabel: input.status,
      webBaseUrl: this.webBaseUrl,
      logoCid: attachments.length > 0 ? this.logoCid : undefined,
    });
    await this.sendTemplateEmail(input.to, template, "shipment status", attachments);
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

    await this.sendTemplateEmail(to, template, "seller application", attachments);
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

    await this.sendTemplateEmail(to, template, "seller rejection", attachments);
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

    await this.sendTemplateEmail(to, template, "seller approval", attachments);
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

  // Gửi template đã render và log theo loại email; lỗi được ném lên consumer để consumer ghi nhận recipient lỗi.
  private async sendTemplateEmail(
    to: string,
    template: { subject: string; html: string; text: string },
    label: string,
    attachments: NonNullable<SendMailOptions["attachments"]>,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        attachments,
      });
      this.logger.log(`${label} email sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send ${label} email to ${to}: ${String(err)}`);
      throw err;
    }
  }

  // Chuẩn hóa CTA tương đối của event thành URL tuyệt đối để email client mở được đúng frontend.
  private toWebUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.webBaseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  }
}
