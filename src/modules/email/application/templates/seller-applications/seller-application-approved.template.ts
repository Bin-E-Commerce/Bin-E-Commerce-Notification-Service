// Template này tạo email xác nhận hồ sơ seller đã được duyệt và CTA vào Seller Center.
// Template chỉ chịu trách nhiệm render nội dung; việc chọn recipient và gửi SMTP thuộc EmailService.

import type {
  EmailBrandOptions,
  EmailTemplate,
} from "../../types/email-template.type";
import {
  escapeEmailHtml,
  formatVietnameseDateTime,
  sanitizeEmailSubject,
} from "../../utils/email-html.util";
import { renderEmailLayout } from "../common/email-layout.template";

interface SellerApplicationApprovedTemplateInput extends EmailBrandOptions {
  shopName: string;
  applicationId: string;
  reviewedAt: string;
}

// Dựng email xác nhận hồ sơ đã đạt với thông tin tra cứu ngắn gọn và CTA trực tiếp vào Seller Center.
export function buildSellerApplicationApprovedTemplate(
  input: SellerApplicationApprovedTemplateInput,
): EmailTemplate {
  const safeShopName = escapeEmailHtml(input.shopName);
  const safeApplicationId = escapeEmailHtml(input.applicationId);
  const reviewedAt = formatVietnameseDateTime(input.reviewedAt);
  const sellerCenterUrl = `${input.webBaseUrl.replace(/\/$/, "")}/seller`;
  const safeSellerCenterUrl = escapeEmailHtml(sellerCenterUrl);

  const content = `
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#52525b;">Hồ sơ người bán</p>
    <h1 style="margin:0;font-family:Arial,sans-serif;font-size:28px;line-height:36px;font-weight:800;color:#18181b;">Shop của bạn đã được duyệt</h1>
    <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:25px;color:#52525b;">
      Chúc mừng! Hồ sơ mở <strong style="color:#18181b;">${safeShopName}</strong> đã hoàn tất kiểm tra. Tài khoản của bạn đã được cấp quyền truy cập Seller Center.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;">
      <tr>
        <td style="padding:18px 20px;">
          <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:#18181b;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;color:#ffffff;">Đã chấp thuận</span>
          <p style="margin:14px 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Mã hồ sơ</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:16px;line-height:24px;font-weight:700;color:#18181b;word-break:break-all;">${safeApplicationId}</p>
          <p style="margin:12px 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Thời gian duyệt</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#18181b;">${escapeEmailHtml(reviewedAt)}</p>
        </td>
      </tr>
    </table>

    <h2 style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:17px;line-height:24px;font-weight:700;color:#18181b;">Bắt đầu vận hành shop</h2>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:23px;color:#52525b;">
      Bạn có thể vào Seller Center để hoàn thiện hồ sơ shop, chuẩn bị sản phẩm và theo dõi các công việc vận hành trong cùng một nơi.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
      <tr>
        <td style="border-radius:8px;background:#18181b;">
          <a href="${safeSellerCenterUrl}" target="_blank" style="display:inline-block;padding:12px 20px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">Mở Seller Center</a>
        </td>
      </tr>
    </table>

    <p style="margin:20px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#71717a;">
      Nếu Seller Center chưa mở ngay trong tab hiện tại, hãy làm mới phiên hoặc đăng nhập lại một lần để nhận role mới trong token.
    </p>`;

  return {
    subject: sanitizeEmailSubject(
      `[Bin] Hồ sơ người bán ${input.shopName} đã được duyệt`,
    ),
    html: renderEmailLayout({
      previewText: `Shop ${input.shopName} đã được chấp thuận trên Bin E-Commerce.`,
      logoCid: input.logoCid,
      content,
    }),
    text: [
      "BIN E-COMMERCE",
      "",
      "HỒ SƠ NGƯỜI BÁN ĐÃ ĐƯỢC DUYỆT",
      `Shop: ${input.shopName}`,
      `Mã hồ sơ: ${input.applicationId}`,
      `Thời gian duyệt: ${reviewedAt}`,
      "",
      "Tài khoản của bạn đã được cấp quyền truy cập Seller Center.",
      `Mở Seller Center: ${sellerCenterUrl}`,
    ].join("\n"),
  };
}
