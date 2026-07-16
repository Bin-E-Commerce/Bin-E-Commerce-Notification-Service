import type {
  EmailBrandOptions,
  EmailTemplate,
} from "../types/email-template.type";
import {
  escapeEmailHtml,
  formatVietnameseDateTime,
  sanitizeEmailSubject,
} from "../utils/email-html.util";
import { renderEmailLayout } from "./email-layout.template";

interface SellerApplicationSubmittedTemplateInput extends EmailBrandOptions {
  shopName: string;
  applicationId: string;
  submittedAt: string;
}

// Dựng email xác nhận seller đã gửi hồ sơ, kèm mã tra cứu và đường dẫn quay lại trang trạng thái hồ sơ.
export function buildSellerApplicationSubmittedTemplate(
  input: SellerApplicationSubmittedTemplateInput,
): EmailTemplate {
  const safeShopName = escapeEmailHtml(input.shopName);
  const safeApplicationId = escapeEmailHtml(input.applicationId);
  const submittedAt = formatVietnameseDateTime(input.submittedAt);
  const applicationUrl = `${input.webBaseUrl.replace(/\/$/, "")}/seller/register`;
  const safeApplicationUrl = escapeEmailHtml(applicationUrl);

  const content = `
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#a16207;">Hồ sơ người bán</p>
    <h1 style="margin:0;font-family:Arial,sans-serif;font-size:28px;line-height:36px;font-weight:800;color:#18181b;">Bin đã nhận hồ sơ của bạn</h1>
    <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:25px;color:#52525b;">
      Cảm ơn bạn đã đăng ký mở <strong style="color:#18181b;">${safeShopName}</strong>. Hồ sơ hiện đã vào hàng chờ kiểm tra của đội ngũ vận hành.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
      <tr>
        <td style="padding:18px 20px;">
          <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:#fef3c7;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;color:#92400e;">Đang chờ duyệt</span>
          <p style="margin:14px 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Mã hồ sơ</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:16px;line-height:24px;font-weight:700;color:#18181b;word-break:break-all;">${safeApplicationId}</p>
          <p style="margin:12px 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Thời gian gửi</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#18181b;">${escapeEmailHtml(submittedAt)}</p>
        </td>
      </tr>
    </table>

    <h2 style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:17px;line-height:24px;font-weight:700;color:#18181b;">Tiếp theo sẽ diễn ra như thế nào?</h2>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:23px;color:#52525b;">
      Bin sẽ đối chiếu thông tin shop, giấy tờ định danh, địa chỉ lấy hàng và tài khoản nhận thanh toán. Bạn sẽ nhận email tiếp theo khi hồ sơ được duyệt hoặc cần bổ sung.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
      <tr>
        <td style="border-radius:8px;background:#18181b;">
          <a href="${safeApplicationUrl}" target="_blank" style="display:inline-block;padding:12px 20px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">Xem trạng thái hồ sơ</a>
        </td>
      </tr>
    </table>

    <p style="margin:20px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#71717a;">
      Nếu cần chỉnh sửa khi hồ sơ đang chờ duyệt, hãy mở trang trạng thái và chọn “Chỉnh sửa hồ sơ”. Thay đổi chỉ được lưu khi bạn gửi lại hồ sơ.
    </p>`;

  return {
    subject: sanitizeEmailSubject(
      `[Bin] Hồ sơ người bán ${input.shopName} đang chờ duyệt`,
    ),
    html: renderEmailLayout({
      previewText: `Bin đã nhận hồ sơ mở shop ${input.shopName}.`,
      logoCid: input.logoCid,
      content,
    }),
    text: [
      "BIN E-COMMERCE",
      "",
      "HỒ SƠ NGƯỜI BÁN ĐÃ ĐƯỢC GỬI",
      `Shop: ${input.shopName}`,
      `Mã hồ sơ: ${input.applicationId}`,
      `Thời gian gửi: ${submittedAt}`,
      "Trạng thái: Đang chờ duyệt",
      "",
      "Bin sẽ gửi email tiếp theo khi hồ sơ được duyệt hoặc cần bổ sung thông tin.",
      `Xem trạng thái hồ sơ: ${applicationUrl}`,
    ].join("\n"),
  };
}
