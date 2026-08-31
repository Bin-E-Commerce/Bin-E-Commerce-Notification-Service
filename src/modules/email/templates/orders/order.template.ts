// Template email cho order tạo mới và hủy đơn, dùng chung nhận diện Bin và CTA theo vai trò người nhận.
// Template chỉ render snapshot từ event, không tự truy vấn order hoặc thêm dữ liệu nhạy cảm vào email.

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

export type OrderEmailRole = "customer" | "seller";

export interface OrderEmailItem {
  productName: string;
  variantName: string;
  imageUrl: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

interface OrderEmailInput extends EmailBrandOptions {
  orderNumber: string;
  role: OrderEmailRole;
  orderUrl: string;
  totalAmount: string;
  createdAt: string;
  cancelledAt?: string;
  cancelReason?: string | null;
  itemCount?: number;
  shopItemTotal?: string;
  items?: OrderEmailItem[];
}

// Dựng email xác nhận order thành công cho customer hoặc seller bằng nội dung phù hợp từng vai trò.
export function buildOrderCreatedTemplate(input: OrderEmailInput): EmailTemplate {
  const safeOrderNumber = escapeEmailHtml(input.orderNumber);
  const safeOrderUrl = escapeEmailHtml(input.orderUrl);
  const createdAt = escapeEmailHtml(formatVietnameseDateTime(input.createdAt));
  const isSeller = input.role === "seller";
  const roleTitle = isSeller ? "Shop có đơn hàng mới" : "Đặt hàng thành công";
  const roleMessage = isSeller
    ? "Một khách hàng vừa đặt sản phẩm thuộc shop của bạn. Hãy mở Seller Center để theo dõi đơn hàng."
    : "Đơn hàng COD của bạn đã được xác nhận và đang được chuẩn bị. Cảm ơn bạn đã mua sắm tại Bin E-Commerce.";
  const detail = isSeller
    ? `<p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#52525b;">${input.itemCount ?? 0} sản phẩm · Doanh thu shop <strong style="color:#18181b;">${escapeEmailHtml(input.shopItemTotal ?? "0.00")} đ</strong></p>`
    : `<p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#52525b;">Phương thức thanh toán: <strong style="color:#18181b;">COD</strong></p><p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#52525b;">Tổng thanh toán: <strong style="color:#18181b;">${escapeEmailHtml(input.totalAmount)} đ</strong></p>`;
  const itemsHtml = !isSeller && input.items?.length
    ? `<h2 style="margin:24px 0 10px;font-family:Arial,sans-serif;font-size:17px;line-height:24px;font-weight:700;color:#18181b;">Sản phẩm đã đặt</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-top:1px solid #e4e4e7;border-bottom:1px solid #e4e4e7;">${input.items.map((item) => {
        const image = item.imageUrl
          ? `<img src="${escapeEmailHtml(item.imageUrl)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #e4e4e7;" />`
          : `<span style="display:block;width:56px;height:56px;border-radius:8px;background:#f4f4f5;border:1px solid #e4e4e7;"></span>`;
        const variant = item.variantName ? ` · ${escapeEmailHtml(item.variantName)}` : "";
        return `<tr><td style="padding:12px 0;vertical-align:top;width:68px;">${image}</td><td style="padding:12px 10px;vertical-align:top;font-family:Arial,sans-serif;"><p style="margin:0;font-size:14px;line-height:20px;font-weight:700;color:#18181b;">${escapeEmailHtml(item.productName)}</p><p style="margin:4px 0 0;font-size:12px;line-height:18px;color:#71717a;">${variant ? `Phân loại${variant}` : "Sản phẩm tiêu chuẩn"} · Số lượng: ${item.quantity}</p></td><td align="right" style="padding:12px 0;vertical-align:top;font-family:Arial,sans-serif;font-size:14px;line-height:20px;font-weight:700;color:#18181b;white-space:nowrap;">${escapeEmailHtml(item.lineTotal)} đ</td></tr>`;
      }).join("")}</table>`
    : "";
  const itemsText = !isSeller && input.items?.length
    ? ["", "SẢN PHẨM ĐÃ ĐẶT", ...input.items.map((item) => `- ${item.productName}${item.variantName ? ` (${item.variantName})` : ""} · SL: ${item.quantity} · ${item.lineTotal} đ`)]
    : [];

  const content = `
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#52525b;">Đơn hàng</p>
    <h1 style="margin:0;font-family:Arial,sans-serif;font-size:28px;line-height:36px;font-weight:800;color:#18181b;">${roleTitle}</h1>
    <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:25px;color:#52525b;">${roleMessage}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Mã đơn hàng</p>
        <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:17px;line-height:25px;font-weight:700;color:#18181b;word-break:break-all;">${safeOrderNumber}</p>
        ${detail}
        <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#71717a;">Đặt ngày ${createdAt}</p>
      </td></tr>
    </table>
    ${itemsHtml}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
      <tr><td style="border-radius:8px;background:#18181b;"><a href="${safeOrderUrl}" target="_blank" style="display:inline-block;padding:12px 20px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">${isSeller ? "Xem đơn hàng" : "Xem đơn hàng của tôi"}</a></td></tr>
    </table>`;

  return {
    subject: sanitizeEmailSubject(`[Bin] ${roleTitle} · ${input.orderNumber}`),
    html: renderEmailLayout({
      previewText: `${roleTitle} ${input.orderNumber}`,
      logoCid: input.logoCid,
      content,
    }),
    text: [
      "BIN E-COMMERCE",
      "",
      roleTitle.toUpperCase(),
      `Mã đơn hàng: ${input.orderNumber}`,
      `Đặt ngày: ${formatVietnameseDateTime(input.createdAt)}`,
      isSeller
        ? `Sản phẩm của shop: ${input.itemCount ?? 0} · Doanh thu: ${input.shopItemTotal ?? "0.00"} đ`
        : `Phương thức thanh toán: COD · Tổng thanh toán: ${input.totalAmount} đ`,
      ...itemsText,
      "",
      `Xem đơn hàng: ${input.orderUrl}`,
    ].join("\n"),
  };
}

// Dựng email hủy đơn cho customer và seller, luôn hiển thị thời điểm cùng lý do nếu customer đã nhập.
export function buildOrderCancelledTemplate(input: OrderEmailInput): EmailTemplate {
  const safeOrderNumber = escapeEmailHtml(input.orderNumber);
  const safeOrderUrl = escapeEmailHtml(input.orderUrl);
  const cancelledAt = escapeEmailHtml(
    formatVietnameseDateTime(input.cancelledAt ?? input.createdAt),
  );
  const safeReason = input.cancelReason
    ? escapeEmailHtml(input.cancelReason)
    : "Không có lý do được cung cấp";
  const isSeller = input.role === "seller";
  const title = isSeller ? "Đơn hàng của shop đã bị hủy" : "Đơn hàng đã được hủy";
  const message = isSeller
    ? "Một đơn hàng có sản phẩm của shop đã được khách hàng hủy."
    : "Đơn hàng của bạn đã được hủy thành công. Nếu cần, bạn có thể quay lại Bin để mua sắm tiếp.";

  const content = `
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#a1a1aa;">Cập nhật đơn hàng</p>
    <h1 style="margin:0;font-family:Arial,sans-serif;font-size:28px;line-height:36px;font-weight:800;color:#18181b;">${title}</h1>
    <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:25px;color:#52525b;">${message}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;background:#fff7f7;border:1px solid #fecaca;border-radius:10px;">
      <tr><td style="padding:18px 20px;">
        <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:#fee2e2;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;color:#b91c1c;">Đã hủy</span>
        <p style="margin:14px 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Mã đơn hàng</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:17px;line-height:25px;font-weight:700;color:#18181b;word-break:break-all;">${safeOrderNumber}</p>
        <p style="margin:12px 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Lý do hủy</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#18181b;">${safeReason}</p>
        <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#71717a;">Hủy ngày ${cancelledAt}</p>
      </td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
      <tr><td style="border-radius:8px;background:#18181b;"><a href="${safeOrderUrl}" target="_blank" style="display:inline-block;padding:12px 20px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">Xem chi tiết đơn hàng</a></td></tr>
    </table>`;

  return {
    subject: sanitizeEmailSubject(`[Bin] Đơn hàng đã hủy · ${input.orderNumber}`),
    html: renderEmailLayout({
      previewText: `Đơn hàng ${input.orderNumber} đã được hủy.`,
      logoCid: input.logoCid,
      content,
    }),
    text: [
      "BIN E-COMMERCE",
      "",
      title.toUpperCase(),
      `Mã đơn hàng: ${input.orderNumber}`,
      `Lý do: ${input.cancelReason ?? "Không có lý do được cung cấp"}`,
      `Hủy ngày: ${formatVietnameseDateTime(input.cancelledAt ?? input.createdAt)}`,
      "",
      `Xem chi tiết: ${input.orderUrl}`,
    ].join("\n"),
  };
}
