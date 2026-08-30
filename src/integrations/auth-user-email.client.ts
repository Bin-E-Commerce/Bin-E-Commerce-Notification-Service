// Client nội bộ này chỉ đọc email theo userId để Notification Service gửi thư đến đúng người nhận.
// Không trả profile, mật khẩu hoặc dữ liệu định danh khác; lỗi tra cứu được để consumer xử lý độc lập với notification in-app.

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface UserEmailResponse {
  email?: string;
}

@Injectable()
export class AuthUserEmailClient {
  private readonly targetBase: string;
  private readonly internalToken: string;

  // Đọc endpoint Auth Service và secret nội bộ từ environment, không hard-code credential trong source.
  constructor(config: ConfigService) {
    this.targetBase = config.get<string>(
      "AUTH_SERVICE_URL",
      "http://localhost:3002",
    );
    this.internalToken = config.get<string>("INTERNAL_SERVICE_TOKEN", "");
  }

  // Resolve email theo keycloakId; null giúp event vẫn tạo được in-app notification khi SMTP identity lookup tạm lỗi.
  async getEmail(userId: string): Promise<string | null> {
    const response = await fetch(
      `${this.targetBase}/api/v1/internal/users/${encodeURIComponent(userId)}/email`,
      {
        headers: {
          accept: "application/json",
          "x-internal-service-token": this.internalToken,
        },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as UserEmailResponse;
    const email = payload.email?.trim().toLowerCase();
    return email || null;
  }
}
