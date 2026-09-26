// Template email thông báo role chính của tài khoản vừa được quản trị viên cập nhật.
// Template chỉ render snapshot event; không truy vấn lại user hoặc xử lý quyền truy cập.

import { UserRole } from '@common/enums/user-role.enum';
import type {
    EmailBrandOptions,
    EmailTemplate,
} from '@/modules/email/application/types/email-template.type';
import {
    escapeEmailHtml,
    formatVietnameseDateTime,
    sanitizeEmailSubject,
} from '@/modules/email/application/utils/email-html.util';
import { renderEmailLayout } from '@/modules/email/application/templates/common/email-layout.template';

interface UserRoleChangedTemplateInput extends EmailBrandOptions {
    name: string;
    previousRole: UserRole;
    role: UserRole;
    reason: string;
    occurredAt: string;
}

// Render email role với nội dung ngắn gọn, nêu role cũ/mới và nhắc đăng nhập lại vì session cũ
// đã bị thu hồi sau thay đổi quyền; mọi giá trị từ admin đều được escape trước khi render HTML.
export function buildUserRoleChangedTemplate(
    input: UserRoleChangedTemplateInput,
): EmailTemplate {
    const safeName = escapeEmailHtml(input.name);
    const safeReason = escapeEmailHtml(input.reason);
    const occurredAt = escapeEmailHtml(
        formatVietnameseDateTime(input.occurredAt),
    );
    const safeLoginUrl = escapeEmailHtml(
        `${input.webBaseUrl.replace(/\/$/, '')}/login`,
    );
    const content = `
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#71717a;">Cập nhật quyền tài khoản</p>
    <h1 style="margin:0;font-family:Arial,sans-serif;font-size:28px;line-height:36px;font-weight:800;color:#18181b;">Quyền tài khoản đã được cập nhật</h1>
    <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:25px;color:#52525b;">
      Xin chào <strong style="color:#18181b;">${safeName}</strong>, role chính của tài khoản đã được thay đổi. Các phiên đăng nhập cũ đã được thu hồi để áp dụng quyền mới an toàn.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#71717a;">Role trước đó</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#71717a;">${input.previousRole}</p>
          <p style="margin:14px 0 6px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#71717a;">Role hiện tại</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:18px;line-height:26px;font-weight:800;color:#18181b;">${input.role}</p>
          <p style="margin:14px 0 6px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#71717a;">Lý do cập nhật</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#52525b;">${safeReason}</p>
          <p style="margin:14px 0 6px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#71717a;">Thời gian</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#18181b;">${occurredAt}</p>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
      <tr><td style="border-radius:8px;background:#18181b;"><a href="${safeLoginUrl}" target="_blank" style="display:inline-block;padding:12px 20px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">Đăng nhập lại</a></td></tr>
    </table>
    <p style="margin:20px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#71717a;">Nếu bạn không yêu cầu thay đổi này, vui lòng liên hệ quản trị viên hoặc Support qua kênh hỗ trợ chính thức.</p>`;

    return {
        subject: sanitizeEmailSubject(`[Bin] Role tài khoản đã được cập nhật`),
        html: renderEmailLayout({
            previewText: `Role tài khoản của bạn đã được đổi sang ${input.role}.`,
            logoCid: input.logoCid,
            content,
        }),
        text: [
            'BIN E-COMMERCE',
            '',
            'ROLE TÀI KHOẢN ĐÃ ĐƯỢC CẬP NHẬT',
            `Xin chào ${input.name},`,
            `Role trước đó: ${input.previousRole}`,
            `Role hiện tại: ${input.role}`,
            `Lý do: ${input.reason}`,
            `Thời gian: ${formatVietnameseDateTime(input.occurredAt)}`,
            '',
            `Đăng nhập lại: ${input.webBaseUrl.replace(/\/$/, '')}/login`,
        ].join('\n'),
    };
}
