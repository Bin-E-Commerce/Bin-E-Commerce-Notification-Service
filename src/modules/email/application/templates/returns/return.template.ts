// File này dựng email cho vòng đời hoàn hàng/hoàn tiền từ snapshot event Kafka.
// Template không tự truy vấn Order Service và không quyết định quyền; consumer chịu trách nhiệm chọn đúng người nhận.

import type { EmailTemplate } from "../../types/email-template.type";
import {
  escapeEmailHtml,
  formatVietnameseDateTime,
  formatVietnameseMoney,
  sanitizeEmailSubject,
} from "../../utils/email-html.util";
import { renderEmailLayout } from "../common/email-layout.template";

export type ReturnEmailRole = "customer" | "seller";

interface ReturnEmailInput {
  orderNumber: string;
  status: string;
  reason: string;
  refundAmount: string;
  note: string | null;
  occurredAt: string;
  orderUrl: string;
  eventName: string;
  role: ReturnEmailRole;
  logoCid?: string;
  webBaseUrl: string;
}

// Render email theo event và audience, luôn escape dữ liệu snapshot trước khi đưa vào HTML.
export function buildReturnStatusTemplate(
  input: ReturnEmailInput,
): EmailTemplate {
  const isSeller = input.role === "seller";
  const isRequested = input.eventName === "return.requested";
  const statusLabel = getReturnStatusLabel(input.status);
  const reasonLabel = getReturnReasonLabel(input.reason);
  const title = isRequested
    ? isSeller
      ? "Có yêu cầu hoàn hàng mới"
      : "Yêu cầu hoàn hàng đã được gửi"
    : "Cập nhật yêu cầu hoàn hàng";
  const message = isRequested
    ? isSeller
      ? "Khách hàng vừa gửi yêu cầu hoàn hàng cho một sản phẩm của shop."
      : "Yêu cầu hoàn hàng của bạn đã được ghi nhận và đang chờ shop xử lý."
    : `${isSeller ? "Yêu cầu hoàn hàng của shop" : "Yêu cầu hoàn hàng của bạn"} vừa được cập nhật sang trạng thái ${statusLabel}.`;
  const safeOrderNumber = escapeEmailHtml(input.orderNumber);
  const safeStatus = escapeEmailHtml(statusLabel);
  const safeReason = escapeEmailHtml(reasonLabel);
  const refundAmountLabel = formatVietnameseMoney(input.refundAmount);
  const safeAmount = escapeEmailHtml(refundAmountLabel);
  const safeDate = escapeEmailHtml(formatVietnameseDateTime(input.occurredAt));
  const safeUrl = escapeEmailHtml(input.orderUrl);
  const safeNote = input.note ? escapeEmailHtml(input.note) : "";
  const noteHtml = safeNote
    ? `<p style="margin:14px 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Ghi chú</p><p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#18181b;">${safeNote}</p>`
    : "";
  const noteText = input.note ? `Ghi chú: ${input.note}` : "";

  const content = `
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#71717a;">Đổi trả &amp; hoàn tiền</p>
    <h1 style="margin:0;font-family:Arial,sans-serif;font-size:28px;line-height:36px;font-weight:800;color:#18181b;">${title}</h1>
    <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:25px;color:#52525b;">${message}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Mã đơn hàng</p>
        <p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:17px;line-height:25px;font-weight:700;color:#18181b;word-break:break-all;">#${safeOrderNumber}</p>
        <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Trạng thái</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:16px;line-height:22px;font-weight:700;color:#18181b;">${safeStatus}</p>
        <p style="margin:14px 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Lý do hoàn</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#18181b;">${safeReason}</p>
        <p style="margin:14px 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Số tiền dự kiến hoàn</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:16px;line-height:22px;font-weight:700;color:#18181b;">${safeAmount} đ</p>
        ${noteHtml}
        <p style="margin:14px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#71717a;">Cập nhật lúc ${safeDate}</p>
      </td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:8px;background:#18181b;"><a href="${safeUrl}" target="_blank" style="display:inline-block;padding:12px 20px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">${isSeller ? "Mở Seller Center" : "Xem yêu cầu hoàn hàng"}</a></td></tr></table>`;

  return {
    subject: sanitizeEmailSubject(`[Bin] ${title} · ${input.orderNumber}`),
    html: renderEmailLayout({
      previewText: `${title} · ${input.orderNumber}`,
      logoCid: input.logoCid,
      content,
    }),
    text: [
      "BIN E-COMMERCE",
      "",
      title.toUpperCase(),
      `Mã đơn hàng: #${input.orderNumber}`,
      `Trạng thái: ${statusLabel}`,
      `Lý do hoàn: ${reasonLabel}`,
      `Số tiền dự kiến hoàn: ${refundAmountLabel} đ`,
      noteText,
      `Cập nhật lúc: ${formatVietnameseDateTime(input.occurredAt)}`,
      "",
      `Xem chi tiết: ${input.webBaseUrl}${input.orderUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// Chuyển enum trạng thái kỹ thuật thành nhãn dễ hiểu trong email cho Customer và Seller.
function getReturnStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    REQUESTED: "Đã tiếp nhận",
    APPROVED: "Đã được duyệt",
    AWAITING_SHIPMENT: "Đang chờ gửi hàng",
    IN_TRANSIT: "Đang hoàn về shop",
    RECEIVED: "Đã nhận hàng hoàn",
    REFUND_PENDING: "Đã kiểm tra đạt · Chờ hoàn tiền",
    REJECTED: "Bị từ chối",
    INSPECTION_FAILED: "Kiểm tra không đạt · Chờ gửi trả sản phẩm",
    CUSTOMER_CANCELLED: "Đã hủy",
  };

  return labels[status] ?? "Đang được xử lý";
}

// Chuyển mã lý do kỹ thuật thành nội dung tiếng Việt trước khi đưa vào email.
function getReturnReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    DAMAGED: "Sản phẩm bị hư hỏng",
    WRONG_ITEM: "Giao sai sản phẩm",
    MISSING_ITEM: "Thiếu sản phẩm",
    NOT_AS_DESCRIBED: "Sản phẩm không đúng mô tả",
    CHANGE_OF_MIND: "Không còn nhu cầu",
    NOT_RECEIVED: "Chưa nhận được hàng",
    OTHER: "Lý do khác",
  };

  return labels[reason] ?? "Lý do khác";
}
