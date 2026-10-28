// Client nội bộ này chỉ đọc email theo Auth DB user ID để Notification Service gửi thư đến đúng người nhận.
// Không trả profile, mật khẩu hoặc dữ liệu định danh khác; lỗi tra cứu được để consumer xử lý độc lập với notification in-app.

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
            'AUTH_SERVICE_URL',
            'http://localhost:3002',
        );
        this.internalToken = config.get<string>('INTERNAL_SERVICE_TOKEN', '');
    }

    // Dùng route by-id vì Kafka event mang Auth DB ID, không mang Keycloak subject.
    // 404 nghĩa tài khoản không còn; lỗi hạ tầng được ném lên consumer để Kafka phát lại event.
    async getEmail(userId: string): Promise<string | null> {
        const response = await fetch(
            `${this.targetBase}/api/v1/internal/users/by-id/${encodeURIComponent(userId)}/email`,
            {
                headers: {
                    accept: 'application/json',
                    'x-internal-service-token': this.internalToken,
                },
                signal: AbortSignal.timeout(5_000),
            },
        );
        // User bị xóa/không tồn tại không thể nhận email; các HTTP lỗi khác cần được retry qua Kafka.
        if (response.status === 404) return null;
        if (!response.ok)
            throw new Error(
                `Auth Service email lookup failed with HTTP ${response.status}`,
            );

        const payload = (await response.json()) as UserEmailResponse;
        const email = payload.email?.trim().toLowerCase();
        return email || null;
    }
}
