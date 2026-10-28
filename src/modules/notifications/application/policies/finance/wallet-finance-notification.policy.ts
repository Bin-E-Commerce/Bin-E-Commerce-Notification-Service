// Policy dựng nội dung và audience cho các trạng thái nạp/rút ví seller.
// Không gửi email hoặc lưu dữ liệu; consumer dùng eventId ổn định để chống tạo trùng cho seller/admin.
import { UserRole } from '@common/enums/user-role.enum';
import { WalletFinanceEvents } from '@common/kafka/events';
import type { WalletFinanceChangedEvent } from '@common/kafka/events';
import {
    NotificationAudienceType,
    NotificationCategory,
    NotificationPriority,
} from '@common/notifications';
import { Injectable } from '@nestjs/common';
import type { CreateNotificationInput } from '@/modules/notifications/application/types/create-notification-input.type';

@Injectable()
export class WalletFinanceNotificationPolicy {
    // Seller nhận một notification cho từng chuyển trạng thái kèm lý do từ chối nếu có.
    buildForSeller(event: WalletFinanceChangedEvent): CreateNotificationInput {
        const content = this.getSellerContent(event);
        return {
            eventId: `${event.eventId}:seller:${event.data.sellerUserId}`,
            eventName: event.eventName,
            eventVersion: event.eventVersion,
            source: event.source,
            category: NotificationCategory.PAYMENT,
            type: `wallet_seller_${event.eventName.replaceAll('.', '_')}`,
            audiences: [
                {
                    type: NotificationAudienceType.USER,
                    value: event.data.sellerUserId,
                },
            ],
            title: content.title,
            message: content.message,
            actionUrl: '/seller/finance',
            badgeKey: 'seller.finance',
            priority: NotificationPriority.HIGH,
            entityType: event.eventName.startsWith('wallet.deposit.')
                ? 'wallet_deposit'
                : 'wallet_withdrawal',
            entityId: event.data.transactionId,
            metadata: {
                shopId: event.data.shopId,
                amount: event.data.amount,
                status: event.data.status,
                note: event.data.note,
            },
            occurredAt: new Date(event.occurredAt),
            expiresAt: this.expiry(event.occurredAt),
        };
    }

    // Chỉ yêu cầu rút mới cần đánh thức admin; status nội bộ về sau không tạo thông báo vận hành trùng lặp.
    buildForAdmin(
        event: WalletFinanceChangedEvent,
    ): CreateNotificationInput | null {
        if (event.eventName !== WalletFinanceEvents.WITHDRAWAL_REQUESTED)
            return null;

        const amount = this.formatMoney(event.data.amount);
        const shopReference = event.data.shopId.slice(0, 8).toUpperCase();
        return {
            eventId: `${event.eventId}:admin`,
            eventName: event.eventName,
            eventVersion: event.eventVersion,
            source: event.source,
            category: NotificationCategory.PAYMENT,
            type: 'wallet_withdrawal_requested_admin',
            audiences: [
                { type: NotificationAudienceType.ROLE, value: UserRole.ADMIN },
            ],
            title: 'Có yêu cầu rút tiền seller mới',
            message: `Shop #${shopReference} yêu cầu rút ${amount} đ. Vui lòng kiểm tra và xử lý yêu cầu.`,
            actionUrl: '/admin/finance',
            badgeKey: 'admin.finance',
            priority: NotificationPriority.HIGH,
            entityType: 'wallet_withdrawal',
            entityId: event.data.transactionId,
            metadata: {
                shopId: event.data.shopId,
                amount: event.data.amount,
                status: event.data.status,
            },
            occurredAt: new Date(event.occurredAt),
            expiresAt: this.expiry(event.occurredAt),
        };
    }

    // Chọn nội dung theo event thay vì status rời rạc để không diễn đạt nhầm PROCESSING thành đã chuyển tiền.
    private getSellerContent(
        event: WalletFinanceChangedEvent,
    ): { title: string; message: string } {
        const amount = this.formatMoney(event.data.amount);
        // Chừa giới hạn độ dài cho câu thông báo dưới 500 ký tự kể cả khi admin ghi lý do dài.
        const rejectionReason = event.data.note?.trim().slice(0, 250);
        switch (event.eventName) {
            // Chỉ event được ghi cùng transaction cộng ví mới xác nhận khoản nạp thành công.
            case WalletFinanceEvents.DEPOSIT_PAID:
                return {
                    title: 'Nạp tiền vào ví thành công',
                    message: `Pay2S đã xác nhận khoản nạp ${amount} đ vào ví seller.`,
                };
            // Không gửi payload lỗi của Pay2S ra ngoài; seller chỉ cần biết trạng thái và bước kế tiếp.
            case WalletFinanceEvents.DEPOSIT_FAILED:
                return {
                    title: 'Giao dịch nạp ví không thành công',
                    message: `Pay2S chưa ghi nhận khoản nạp ${amount} đ. Hãy kiểm tra giao dịch ngân hàng trước khi thử lại.`,
                };
            // Request mới giữ tiền trong ví và cần đánh thức admin xử lý.
            case WalletFinanceEvents.WITHDRAWAL_REQUESTED:
                return {
                    title: 'Yêu cầu rút tiền đã được tiếp nhận',
                    message: `Yêu cầu rút ${amount} đ đã được ghi nhận; số tiền đang được giữ chỗ trong ví và chờ admin xử lý.`,
                };
            // PROCESSING chưa chứng minh tiền đã đến tài khoản seller nên nội dung phải giữ trạng thái đang xử lý.
            case WalletFinanceEvents.WITHDRAWAL_PROCESSING:
                return {
                    title: 'Yêu cầu rút tiền đang được xử lý',
                    message: `Admin đã bắt đầu xử lý yêu cầu rút ${amount} đ. Trạng thái hoàn tất sẽ cập nhật sau khi tiền được xác nhận đã chuyển.`,
                };
            // PAID chỉ được phát sau đối soát và admin xác minh người nhận.
            case WalletFinanceEvents.WITHDRAWAL_PAID:
                return {
                    title: 'Yêu cầu rút tiền đã hoàn tất',
                    message: `Admin đã xác nhận chuyển ${amount} đ vào tài khoản seller đã đăng ký.`,
                };
            // Lý do từ chối là nội dung seller cần biết; khoản giữ chỗ đã được hoàn lại trước khi phát event.
            case WalletFinanceEvents.WITHDRAWAL_REJECTED:
                return {
                    title: 'Yêu cầu rút tiền bị từ chối',
                    message: `Yêu cầu rút ${amount} đ bị từ chối. Lý do: ${rejectionReason || 'Vui lòng xem chi tiết trong lịch sử tài chính.'} Tiền đã được trả lại số dư khả dụng.`,
                };
        }

        throw new Error(`Unsupported wallet finance event: ${event.eventName}`);
    }

    // Định dạng số tiền an toàn cho nội dung feed và giữ nguyên giá trị nếu payload bất thường.
    private formatMoney(value: string): string {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return value;
        return new Intl.NumberFormat('vi-VN', {
            maximumFractionDigits: 0,
        }).format(Math.round(amount));
    }

    // Giữ notification đủ lâu để seller còn tra cứu lịch sử xử lý payout.
    private expiry(occurredAt: string): Date {
        const expiry = new Date(occurredAt);
        expiry.setUTCDate(expiry.getUTCDate() + 90);
        return expiry;
    }
}
