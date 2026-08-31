// File này tạo email shipment responsive, dùng layout branding chung của Notification Service.

import type { EmailTemplate } from '../../types/email-template.type';
import { escapeEmailHtml, formatVietnameseDateTime, sanitizeEmailSubject } from '../../utils/email-html.util';
import { renderEmailLayout } from '../common/email-layout.template';

export type ShipmentEmailRole = 'customer' | 'seller';

// Render email theo status và role, chỉ sử dụng snapshot an toàn từ event shipment.
export function buildShipmentStatusTemplate(input: {
  orderNumber: string;
  trackingCode: string;
  statusLabel: string;
  locationLabel: string;
  occurredAt: string;
  orderUrl: string;
  role: ShipmentEmailRole;
  logoCid?: string;
  webBaseUrl: string;
}): EmailTemplate {
  const title = input.role === 'seller' ? 'Cập nhật vận đơn của shop' : 'Đơn hàng đang trên hành trình';
  const message = input.role === 'seller'
    ? 'Vận đơn của shop vừa có cập nhật mới trong hệ thống mô phỏng.'
    : 'Hành trình đơn hàng của bạn vừa được cập nhật. Bạn có thể mở chi tiết để xem vị trí hiện tại.';
  const safeOrderNumber = escapeEmailHtml(input.orderNumber);
  const safeTrackingCode = escapeEmailHtml(input.trackingCode);
  const safeStatus = escapeEmailHtml(input.statusLabel);
  const safeLocation = escapeEmailHtml(input.locationLabel);
  const safeDate = escapeEmailHtml(formatVietnameseDateTime(input.occurredAt));
  const safeUrl = escapeEmailHtml(input.orderUrl);

  const content = `
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#52525b;">Vận chuyển</p>
    <h1 style="margin:0;font-family:Arial,sans-serif;font-size:28px;line-height:36px;font-weight:800;color:#18181b;">${title}</h1>
    <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:25px;color:#52525b;">${message}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;color:#71717a;">Mã đơn hàng</p>
        <p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:17px;font-weight:700;color:#18181b;">#${safeOrderNumber}</p>
        <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;color:#71717a;">Trạng thái</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:16px;font-weight:700;color:#059669;">${safeStatus}</p>
        <p style="margin:14px 0 4px;font-family:Arial,sans-serif;font-size:12px;color:#71717a;">Mã vận đơn</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#18181b;">${safeTrackingCode}</p>
        <p style="margin:14px 0 4px;font-family:Arial,sans-serif;font-size:12px;color:#71717a;">Vị trí cập nhật</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#52525b;">${safeLocation}</p>
        <p style="margin:14px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#71717a;">Cập nhật lúc ${safeDate}</p>
      </td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:8px;background:#18181b;"><a href="${safeUrl}" target="_blank" style="display:inline-block;padding:12px 20px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">${input.role === 'seller' ? 'Mở Seller Center' : 'Theo dõi đơn hàng'}</a></td></tr></table>`;

  const subject = sanitizeEmailSubject(`[Bin] ${input.statusLabel} · ${input.orderNumber}`);
  return {
    subject,
    html: renderEmailLayout({ previewText: `${input.statusLabel} · ${input.orderNumber}`, logoCid: input.logoCid, content }),
    text: [
      'BIN E-COMMERCE',
      '',
      title.toUpperCase(),
      `Mã đơn hàng: #${input.orderNumber}`,
      `Trạng thái: ${input.statusLabel}`,
      `Mã vận đơn: ${input.trackingCode}`,
      `Vị trí: ${input.locationLabel}`,
      `Cập nhật lúc: ${formatVietnameseDateTime(input.occurredAt)}`,
      '',
      `Xem chi tiết: ${input.orderUrl}`,
    ].join('\n'),
  };
}
