// Template email thông báo tài khoản bị ban hoặc được gỡ ban.
// Template chỉ render snapshot từ Kafka event; recipient và SMTP transport thuộc EmailService.

import type {
    EmailBrandOptions,
    EmailTemplate,
} from '@/modules/email/application/types/email-template.type';
import { UserStatus } from '@common/enums/user-status.enum';
import {
    escapeEmailHtml,
    formatVietnameseDateTime,
    sanitizeEmailSubject,
} from '@/modules/email/application/utils/email-html.util';
import { renderEmailLayout } from '@/modules/email/application/templates/common/email-layout.template';

interface UserStatusChangedTemplateInput extends EmailBrandOptions {
    name: string;
    status: UserStatus;
    reason: string;
    occurredAt: string;
}

// Render nội dung khác nhau cho BANNED và ACTIVE để người nhận biết ngay tài khoản đang bị khóa
// hay đã được khôi phục, đồng thời luôn escape tên/lý do trước khi đưa vào HTML email.
export function buildUserStatusChangedTemplate(
    input: UserStatusChangedTemplateInput,
): EmailTemplate {
    const safeName = escapeEmailHtml(input.name);
    const safeReason = escapeEmailHtml(input.reason);
    const occurredAt = escapeEmailHtml(
        formatVietnameseDateTime(input.occurredAt),
    );
    const isBanned = input.status === UserStatus.BANNED;
    const title = isBanned
        ? 'Tài khoản của bạn đã bị khóa'
        : 'Tài khoản của bạn đã được mở khóa';
    const subject = isBanned
        ? 'Tài khoản bị khóa'
        : 'Tài khoản đã được mở khóa';
    const description = isBanned
        ? 'Tài khoản hiện không thể đăng nhập hoặc tạo phiên sử dụng mới.'
        : 'Bạn có thể đăng nhập lại và tiếp tục sử dụng các dịch vụ của Bin E-Commerce.';
    const safeLoginUrl = escapeEmailHtml(
        `${input.webBaseUrl.replace(/\/$/, '')}/login`,
    );

    const content = `
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#71717a;">Cập nhật tài khoản</p>
    <h1 style="margin:0;font-family:Arial,sans-serif;font-size:28px;line-height:36px;font-weight:800;color:#18181b;">${title}</h1>
    <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:25px;color:#52525b;">
      Xin chào <strong style="color:#18181b;">${safeName}</strong>, ${description}
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#71717a;">Trạng thái hiện tại</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:18px;line-height:26px;font-weight:800;color:#18181b;">${input.status}</p>
          <p style="margin:14px 0 6px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#71717a;">Lý do cập nhật</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#52525b;">${safeReason}</p>
          <p style="margin:14px 0 6px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#71717a;">Thời gian</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#18181b;">${occurredAt}</p>
        </td>
      </tr>
    </table>

    ${
        isBanned
            ? `<p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:23px;color:#52525b;">Nếu bạn cho rằng quyết định này chưa chính xác, vui lòng liên hệ quản trị viên hoặc bộ phận Support qua kênh hỗ trợ chính thức của Bin E-Commerce và cung cấp email đăng ký để được xem xét.</p>`
            : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td style="border-radius:8px;background:#18181b;"><a href="${safeLoginUrl}" target="_blank" style="display:inline-block;padding:12px 20px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">Đăng nhập lại</a></td></tr></table>`
    }`;

    return {
        subject: sanitizeEmailSubject(`[Bin] ${subject}`),
        html: renderEmailLayout({
            previewText: `${subject} trên Bin E-Commerce.`,
            logoCid: input.logoCid,
            content,
        }),
        text: [
            'BIN E-COMMERCE',
            '',
            subject.toUpperCase(),
            `Xin chào ${input.name},`,
            description,
            `Trạng thái: ${input.status}`,
            `Lý do: ${input.reason}`,
            `Thời gian: ${formatVietnameseDateTime(input.occurredAt)}`,
            '',
            isBanned
                ? 'Liên hệ quản trị viên hoặc Support qua kênh hỗ trợ chính thức nếu bạn cần yêu cầu xem xét.'
                : `Đăng nhập lại: ${input.webBaseUrl.replace(/\/$/, '')}/login`,
        ].join('\n'),
    };
}
