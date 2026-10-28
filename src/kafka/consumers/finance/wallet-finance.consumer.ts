// Consumer nhận event ví đã commit, ghi feed realtime và xếp email seller vào hàng đợi retry.
import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
    WalletFinanceChangedEvent,
    WalletFinanceEvents,
} from '@common/kafka/events';
import { AuthUserEmailClient } from '@/integrations/auth-user-email.client';
import { EmailDeliveryService } from '@/modules/email/application/services/email-delivery.service';
import { WalletFinanceNotificationPolicy } from '@/modules/notifications/application/policies/finance/wallet-finance-notification.policy';
import { NotificationsService } from '@/modules/notifications/application/services/notifications.service';

@Controller()
export class WalletFinanceConsumer {
    private readonly logger = new Logger(WalletFinanceConsumer.name);

    constructor(
        private readonly notifications: NotificationsService,
        private readonly policy: WalletFinanceNotificationPolicy,
        private readonly emailDelivery: EmailDeliveryService,
        private readonly userEmailClient: AuthUserEmailClient,
    ) {}

    // Thông báo seller khi Pay2S đã ghi có thật vào ví.
    @EventPattern(WalletFinanceEvents.DEPOSIT_PAID)
    async handleDepositPaid(
        @Payload() event: WalletFinanceChangedEvent,
    ): Promise<void> {
        await this.handleSellerEvent(event);
    }

    // Thông báo seller giao dịch nạp thất bại nhưng không đưa nội dung provider vào feed/email.
    @EventPattern(WalletFinanceEvents.DEPOSIT_FAILED)
    async handleDepositFailed(
        @Payload() event: WalletFinanceChangedEvent,
    ): Promise<void> {
        await this.handleSellerEvent(event);
    }

    // Yêu cầu rút mới tạo thông báo cho seller và role admin để đội vận hành tiếp nhận.
    @EventPattern(WalletFinanceEvents.WITHDRAWAL_REQUESTED)
    async handleWithdrawalRequested(
        @Payload() event: WalletFinanceChangedEvent,
    ): Promise<void> {
        const adminNotification = this.policy.buildForAdmin(event);
        if (adminNotification)
            await this.notifications.createFromEvent(adminNotification);
        await this.handleSellerEvent(event);
    }

    // Báo seller admin đã bắt đầu xử lý nhưng chưa xác nhận chuyển tiền hoàn tất.
    @EventPattern(WalletFinanceEvents.WITHDRAWAL_PROCESSING)
    async handleWithdrawalProcessing(
        @Payload() event: WalletFinanceChangedEvent,
    ): Promise<void> {
        await this.handleSellerEvent(event);
    }

    // Chỉ event PAID sau đối soát mới được gửi email xác nhận tiền đã chuyển cho seller.
    @EventPattern(WalletFinanceEvents.WITHDRAWAL_PAID)
    async handleWithdrawalPaid(
        @Payload() event: WalletFinanceChangedEvent,
    ): Promise<void> {
        await this.handleSellerEvent(event);
    }

    // Gửi lý do từ chối cùng xác nhận rằng khoản giữ chỗ đã được hoàn về số dư khả dụng.
    @EventPattern(WalletFinanceEvents.WITHDRAWAL_REJECTED)
    async handleWithdrawalRejected(
        @Payload() event: WalletFinanceChangedEvent,
    ): Promise<void> {
        await this.handleSellerEvent(event);
    }

    // Dùng khóa người nhận riêng để admin role và seller không ghi đè notification của nhau.
    private async handleSellerEvent(
        event: WalletFinanceChangedEvent,
    ): Promise<void> {
        this.logger.log(`Received wallet finance event ${event.eventId}`);
        const input = this.policy.buildForSeller(event);
        await this.notifications.createFromEvent(input);

        // Tìm email sau khi lưu feed; email outbox tự retry SMTP và dedupe Kafka redelivery.
        const email = await this.userEmailClient.getEmail(
            event.data.sellerUserId,
        );
        if (!email) {
            this.logger.warn(
                `No email found for wallet finance notification user ${event.data.sellerUserId}`,
            );
            return;
        }
        await this.emailDelivery.enqueueWalletFinanceStatus(
            `${input.eventId}:email`,
            {
                to: email,
                eventName: event.eventName,
                transactionId: event.data.transactionId,
                amount: event.data.amount,
                note: event.data.note,
                occurredAt: event.occurredAt,
                actionUrl: input.actionUrl ?? '/seller/finance',
            },
        );
    }
}
