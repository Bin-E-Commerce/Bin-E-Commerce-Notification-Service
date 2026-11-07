// Template này xác nhận email customer sau khi admin đã ghi nhận chuyển khoản hoàn tiền.
// Dữ liệu lấy từ event snapshot; template không truy vấn order hoặc đưa thông tin tài khoản vào email.

import type {
    EmailBrandOptions,
    EmailTemplate,
} from '@/modules/email/application/types/email-template.type';
import { renderEmailLayout } from '@/modules/email/application/templates/common/email-layout.template';
import {
    escapeEmailHtml,
    formatVietnameseDateTime,
    formatVietnameseMoney,
    sanitizeEmailSubject,
} from '@/modules/email/application/utils/email-html.util';

export interface RefundCompletedTemplateInput extends EmailBrandOptions {
    orderNumber: string;
    refundAmount: string;
    occurredAt: string;
    orderUrl: string;
    webBaseUrl: string;
}

// Render xác nhận hoàn tiền và escape từng giá trị snapshot trước khi ghép HTML/email subject.
export function buildRefundCompletedTemplate(
    input: RefundCompletedTemplateInput,
): EmailTemplate {
    const safeOrderNumber = escapeEmailHtml(input.orderNumber);
    const refundAmount = formatVietnameseMoney(input.refundAmount);
    const safeRefundAmount = escapeEmailHtml(refundAmount);
    const processedAt = formatVietnameseDateTime(input.occurredAt);
    const safeProcessedAt = escapeEmailHtml(processedAt);
    const safeOrderUrl = escapeEmailHtml(input.orderUrl);
    const title = 'Khoản hoàn tiền đã được chuyển';
    const message =
        'Admin đã xác nhận chuyển khoản hoàn tiền cho đơn hàng của bạn. Vui lòng kiểm tra tài khoản ngân hàng đã đăng ký; thời gian tiền ghi có có thể phụ thuộc vào ngân hàng nhận.';
    const content = `
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#047857;">Hoàn tiền</p>
    <h1 style="margin:0;font-family:Arial,sans-serif;font-size:28px;line-height:36px;font-weight:800;color:#18181b;">${title}</h1>
    <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:25px;color:#52525b;">${message}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;">
      <tr><td style="padding:20px;">
        <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:#d1fae5;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;color:#047857;">ĐÃ XÁC NHẬN</span>
        <p style="margin:16px 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Mã đơn hàng</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:17px;line-height:25px;font-weight:700;color:#18181b;word-break:break-all;">#${safeOrderNumber}</p>
        <p style="margin:14px 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Số tiền hoàn</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:22px;line-height:30px;font-weight:800;color:#047857;">${safeRefundAmount} đ</p>
        <p style="margin:14px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#71717a;">Xác nhận lúc ${safeProcessedAt}</p>
      </td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:8px;background:#18181b;"><a href="${safeOrderUrl}" target="_blank" style="display:inline-block;padding:12px 20px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">Xem chi tiết đơn hàng</a></td></tr></table>`;

    return {
        subject: sanitizeEmailSubject(
            `[Bin] Đã chuyển khoản hoàn tiền · ${input.orderNumber}`,
        ),
        html: renderEmailLayout({
            previewText: `${title} · ${input.orderNumber}`,
            logoCid: input.logoCid,
            content,
        }),
        text: [
            'BIN E-COMMERCE',
            '',
            title.toUpperCase(),
            message,
            `Mã đơn hàng: #${input.orderNumber}`,
            `Số tiền hoàn: ${refundAmount} đ`,
            `Xác nhận lúc: ${processedAt}`,
            '',
            `Xem chi tiết đơn hàng: ${input.webBaseUrl}${input.orderUrl}`,
        ].join('\n'),
    };
}
