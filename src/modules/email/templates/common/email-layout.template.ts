// Template này dựng khung HTML dùng chung cho mọi email của Bin E-Commerce.
// Layout chỉ chịu trách nhiệm trình bày và branding, không chứa nội dung nghiệp vụ của từng sự kiện.

import { escapeEmailHtml } from "../../utils/email-html.util";

interface EmailLayoutInput {
  previewText: string;
  logoCid?: string;
  content: string;
}

// Dựng khung email dùng table và style inline để hiển thị ổn định trên Gmail, Outlook và ứng dụng mail di động.
export function renderEmailLayout(input: EmailLayoutInput): string {
  const safePreviewText = escapeEmailHtml(input.previewText);
  const brand = input.logoCid
    ? `<img src="cid:${escapeEmailHtml(input.logoCid)}" width="138" alt="Bin E-Commerce" style="display:block;width:138px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />`
    : `<span style="font-family:Arial,sans-serif;font-size:21px;line-height:28px;font-weight:800;color:#18181b;">BIN E-COMMERCE</span>`;

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bin E-Commerce</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;color:#18181b;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreviewText}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f4f4f5;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#ffffff;padding:18px 28px;border-bottom:1px solid #e4e4e7;">${brand}</td>
            </tr>
            <tr>
              <td style="padding:32px 28px 28px;">${input.content}</td>
            </tr>
            <tr>
              <td style="padding:20px 28px;border-top:1px solid #e4e4e7;background:#fafafa;">
                <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#71717a;">
                  Email tự động từ Bin E-Commerce. Vui lòng không gửi thông tin mật khẩu hoặc mã OTP qua email.
                </p>
                <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#a1a1aa;">
                  © Bin E-Commerce · Mua sắm an tâm, bán hàng chuyên nghiệp.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
