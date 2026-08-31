// Template này tạo email trả hồ sơ seller, nêu rõ lý do và đường dẫn chỉnh sửa.
// Template không cập nhật trạng thái hồ sơ; nó chỉ hiển thị snapshot từ event nghiệp vụ.

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

interface SellerApplicationRejectedTemplateInput extends EmailBrandOptions {
  shopName: string;
  applicationId: string;
  reviewedAt: string;
  reviewNote: string;
  correctionTargets: string[];
}

// Dựng email trả hồ sơ với lý do nổi bật và CTA quay lại đúng form để người bán sửa rồi gửi lại.
export function buildSellerApplicationRejectedTemplate(
  input: SellerApplicationRejectedTemplateInput,
): EmailTemplate {
  const safeShopName = escapeEmailHtml(input.shopName);
  const safeApplicationId = escapeEmailHtml(input.applicationId);
  const safeReviewNote = escapeEmailHtml(input.reviewNote).replace(/\n/g, "<br />");
  const reviewedAt = formatVietnameseDateTime(input.reviewedAt);
  const applicationUrl = `${input.webBaseUrl.replace(/\/$/, "")}/seller/register`;
  const safeApplicationUrl = escapeEmailHtml(applicationUrl);
  const correctionItems = input.correctionTargets
    .map((target) => getCorrectionTargetLabel(target))
    .map(
      (label) =>
        `<li style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#52525b;">${escapeEmailHtml(label)}</li>`,
    )
    .join("");

  const content = `
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#b91c1c;">Hồ sơ cần bổ sung</p>
    <h1 style="margin:0;font-family:Arial,sans-serif;font-size:28px;line-height:36px;font-weight:800;color:#18181b;">Vui lòng cập nhật hồ sơ người bán</h1>
    <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:25px;color:#52525b;">
      Hồ sơ mở <strong style="color:#18181b;">${safeShopName}</strong> chưa thể được chấp thuận ở lần kiểm tra này. Thông tin đã nhập vẫn được giữ để bạn chỉnh sửa và gửi lại.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;">
      <tr>
        <td style="padding:18px 20px;">
          <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:#fee2e2;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;color:#991b1b;">Cần chỉnh sửa</span>
          <p style="margin:14px 0 6px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Nội dung cần bổ sung</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;line-height:24px;font-weight:600;color:#18181b;">${safeReviewNote}</p>
        </td>
      </tr>
    </table>

    ${
      correctionItems
        ? `<h2 style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:16px;line-height:24px;font-weight:700;color:#18181b;">Các nhóm thông tin cần cập nhật</h2>
           <ul style="margin:0 0 24px;padding-left:20px;">${correctionItems}</ul>`
        : ""
    }

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;">
      <tr>
        <td style="padding:0 0 8px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Mã hồ sơ</td>
        <td align="right" style="padding:0 0 8px;font-family:Arial,sans-serif;font-size:13px;line-height:18px;font-weight:700;color:#18181b;">${safeApplicationId}</td>
      </tr>
      <tr>
        <td style="font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Thời gian xử lý</td>
        <td align="right" style="font-family:Arial,sans-serif;font-size:13px;line-height:18px;color:#18181b;">${escapeEmailHtml(reviewedAt)}</td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="border-radius:8px;background:#18181b;">
          <a href="${safeApplicationUrl}" target="_blank" style="display:inline-block;padding:12px 20px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">Chỉnh sửa hồ sơ</a>
        </td>
      </tr>
    </table>

    <p style="margin:20px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#71717a;">
      Sau khi cập nhật đầy đủ, hãy kiểm tra lại toàn bộ thông tin và chọn “Gửi hồ sơ duyệt” để hồ sơ quay lại hàng chờ xử lý.
    </p>`;

  return {
    subject: sanitizeEmailSubject(
      `[Bin] Hồ sơ người bán ${input.shopName} cần được cập nhật`,
    ),
    html: renderEmailLayout({
      previewText: `Hồ sơ ${input.shopName} cần bổ sung thông tin trước khi được duyệt.`,
      logoCid: input.logoCid,
      content,
    }),
    text: [
      "BIN E-COMMERCE",
      "",
      "HỒ SƠ NGƯỜI BÁN CẦN BỔ SUNG",
      `Shop: ${input.shopName}`,
      `Mã hồ sơ: ${input.applicationId}`,
      `Thời gian xử lý: ${reviewedAt}`,
      "",
      `Nội dung cần bổ sung: ${input.reviewNote}`,
      ...input.correctionTargets.map(
        (target) => `- ${getCorrectionTargetLabel(target)}`,
      ),
      "",
      `Chỉnh sửa và gửi lại hồ sơ: ${applicationUrl}`,
    ].join("\n"),
  };
}

// Chuyển machine code từ event thành nhãn dễ hiểu; code lạ vẫn được hiển thị để email không làm mất thông tin khi contract mở rộng.
function getCorrectionTargetLabel(target: string): string {
  switch (target) {
    case "shop_information":
      return "Thông tin shop";
    case "shop_logo":
      return "Logo shop";
    case "seller_identity":
      return "Thông tin định danh người bán";
    case "verification_documents":
      return "Giấy tờ xác minh";
    case "pickup_address":
      return "Địa chỉ lấy hàng";
    case "payout_information":
      return "Thông tin thanh toán";
    default:
      return target;
  }
}
