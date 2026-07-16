import type { EmailTemplate } from "../types/email-template.type";
import { escapeEmailHtml } from "../utils/email-html.util";
import { renderEmailLayout } from "./email-layout.template";

interface OtpTemplateInput {
  otp: string;
  purpose: string;
  expiresMinutes: number;
  logoCid?: string;
}

// Chuyển mã purpose kỹ thuật thành nội dung người dùng có thể hiểu trong email xác thực.
function getPurposeCopy(purpose: string): {
  action: string;
  subject: string;
} {
  if (purpose === "REGISTER") {
    return {
      action: "hoàn tất đăng ký tài khoản",
      subject: "Xác nhận đăng ký tài khoản",
    };
  }

  if (purpose === "RESET_PASSWORD") {
    return {
      action: "đặt lại mật khẩu",
      subject: "Xác nhận đặt lại mật khẩu",
    };
  }

  return {
    action: "xác thực yêu cầu của bạn",
    subject: "Mã xác thực tài khoản",
  };
}

// Dựng email OTP có plain-text fallback và không đưa mã nhạy cảm vào subject hoặc preview text.
export function buildOtpTemplate(input: OtpTemplateInput): EmailTemplate {
  const purposeCopy = getPurposeCopy(input.purpose);
  const safeOtp = escapeEmailHtml(input.otp);
  const content = `
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#71717a;">Bảo mật tài khoản</p>
    <h1 style="margin:0;font-family:Arial,sans-serif;font-size:28px;line-height:36px;font-weight:800;color:#18181b;">${purposeCopy.subject}</h1>
    <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:25px;color:#52525b;">
      Dùng mã bên dưới để ${purposeCopy.action}. Mã chỉ có hiệu lực trong <strong style="color:#18181b;">${input.expiresMinutes} phút</strong>.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:10px;">
      <tr>
        <td align="center" style="padding:24px 16px;">
          <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#71717a;">Mã xác thực</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:36px;line-height:44px;font-weight:800;letter-spacing:10px;color:#18181b;">${safeOtp}</p>
        </td>
      </tr>
    </table>

    <div style="padding:16px 18px;border-left:4px solid #18181b;background:#fafafa;">
      <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;line-height:21px;color:#52525b;">
        Không chia sẻ mã này với bất kỳ ai, kể cả người tự nhận là nhân viên Bin E-Commerce. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.
      </p>
    </div>`;

  return {
    subject: `[Bin] ${purposeCopy.subject}`,
    html: renderEmailLayout({
      previewText: `Mã xác thực Bin E-Commerce có hiệu lực trong ${input.expiresMinutes} phút.`,
      logoCid: input.logoCid,
      content,
    }),
    text: [
      "BIN E-COMMERCE",
      "",
      purposeCopy.subject.toUpperCase(),
      `Mã xác thực: ${input.otp}`,
      `Mã có hiệu lực trong ${input.expiresMinutes} phút.`,
      "",
      "Không chia sẻ mã này với bất kỳ ai. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.",
    ].join("\n"),
  };
}
