// Template email cho trạng thái nạp/rút ví seller; không chứa số tài khoản hoặc dữ liệu provider.
import { WalletFinanceEvents } from '@common/kafka/events';
import type { WalletFinanceEventName } from '@common/kafka/events';
import type { EmailTemplate } from '@/modules/email/application/types/email-template.type';
import {
    escapeEmailHtml,
    formatVietnameseDateTime,
    formatVietnameseMoney,
    sanitizeEmailSubject,
} from '@/modules/email/application/utils/email-html.util';
import { renderEmailLayout } from '@/modules/email/application/templates/common/email-layout.template';

interface WalletFinanceEmailInput {
    eventName: WalletFinanceEventName;
    transactionId: string;
    amount: string;
    note: string | null;
    occurredAt: string;
    actionUrl: string;
    webBaseUrl: string;
    logoCid?: string;
}

// Chọn nội dung theo event, escape toàn bộ dữ liệu từ giao dịch và tạo cả HTML lẫn plain-text fallback.
export function buildWalletFinanceTemplate(
    input: WalletFinanceEmailInput,
): EmailTemplate {
    const content = getEmailContent(input.eventName, input.note);
    const safeTitle = escapeEmailHtml(content.title);
    const safeMessage = escapeEmailHtml(content.message);
    const safeTransactionId = escapeEmailHtml(input.transactionId);
    const safeAmount = escapeEmailHtml(formatVietnameseMoney(input.amount));
    const safeDate = escapeEmailHtml(
        formatVietnameseDateTime(input.occurredAt),
    );
    const safeActionUrl = escapeEmailHtml(
        toWebUrl(input.webBaseUrl, input.actionUrl),
    );

    const html = `
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#71717a;">Tài chính seller</p>
    <h1 style="margin:0;font-family:Arial,sans-serif;font-size:28px;line-height:36px;font-weight:800;color:#18181b;">${safeTitle}</h1>
    <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:25px;color:#52525b;">${safeMessage}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Số tiền</p>
        <p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:18px;line-height:26px;font-weight:700;color:#18181b;">${safeAmount} đ</p>
        <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Mã yêu cầu</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#18181b;word-break:break-all;">${safeTransactionId}</p>
        ${content.noteHtml}
        <p style="margin:14px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#71717a;">Cập nhật lúc ${safeDate}</p>
      </td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:8px;background:#18181b;"><a href="${safeActionUrl}" target="_blank" style="display:inline-block;padding:12px 20px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">Mở quản lý tài chính</a></td></tr></table>`;

    return {
        subject: sanitizeEmailSubject(`[Bin] ${content.title}`),
        html: renderEmailLayout({
            previewText: `${content.title} · ${formatVietnameseMoney(input.amount)} đ`,
            logoCid: input.logoCid,
            content: html,
        }),
        text: [
            'BIN E-COMMERCE',
            '',
            content.title.toUpperCase(),
            content.message,
            `Số tiền: ${formatVietnameseMoney(input.amount)} đ`,
            `Mã yêu cầu: ${input.transactionId}`,
            input.note ? `Lý do: ${input.note}` : '',
            `Cập nhật lúc: ${formatVietnameseDateTime(input.occurredAt)}`,
            '',
            `Xem chi tiết: ${toWebUrl(input.webBaseUrl, input.actionUrl)}`,
        ]
            .filter(Boolean)
            .join('\n'),
    };
}

// Gắn nội dung từ chối đã escape vào template và không hiển thị ghi chú vận hành ở trạng thái khác.
function getEmailContent(
    eventName: WalletFinanceEventName,
    note: string | null,
): { title: string; message: string; noteHtml: string } {
    const contentByEvent: Record<
        WalletFinanceEventName,
        { title: string; message: string }
    > = {
        [WalletFinanceEvents.DEPOSIT_PAID]: {
            title: 'Nạp tiền vào ví thành công',
            message: 'Pay2S đã xác nhận khoản tiền nạp vào ví seller.',
        },
        [WalletFinanceEvents.DEPOSIT_FAILED]: {
            title: 'Giao dịch nạp ví không thành công',
            message: 'Pay2S chưa ghi nhận khoản nạp. Hãy kiểm tra giao dịch ngân hàng trước khi thử lại.',
        },
        [WalletFinanceEvents.WITHDRAWAL_REQUESTED]: {
            title: 'Yêu cầu rút tiền đã được tiếp nhận',
            message: 'Yêu cầu rút tiền đã được ghi nhận và khoản tiền đang được giữ chỗ trong ví.',
        },
        [WalletFinanceEvents.WITHDRAWAL_PROCESSING]: {
            title: 'Yêu cầu rút tiền đang được xử lý',
            message: 'Admin đã bắt đầu xử lý. Trạng thái hoàn tất sẽ cập nhật sau khi tiền được xác nhận đã chuyển.',
        },
        [WalletFinanceEvents.WITHDRAWAL_PAID]: {
            title: 'Yêu cầu rút tiền đã hoàn tất',
            message: 'Admin đã xác nhận chuyển tiền vào tài khoản seller đã đăng ký.',
        },
        [WalletFinanceEvents.WITHDRAWAL_REJECTED]: {
            title: 'Yêu cầu rút tiền bị từ chối',
            message: 'Khoản tiền đã được trả lại số dư khả dụng trong ví seller.',
        },
    };
    const content = contentByEvent[eventName];
    const safeNote =
        eventName === WalletFinanceEvents.WITHDRAWAL_REJECTED && note?.trim()
            ? escapeEmailHtml(note.trim())
            : '';
    const noteHtml = safeNote
        ? `<p style="margin:14px 0 4px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">Lý do từ chối</p><p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#18181b;">${safeNote}</p>`
        : '';
    return { ...content, noteHtml };
}

// Chuẩn hóa đường dẫn tương đối của email thành URL tuyệt đối tới Seller Center.
function toWebUrl(webBaseUrl: string, path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    return `${webBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
