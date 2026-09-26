// Consumer nhận event ban/gỡ ban từ Auth Service và gửi email đến đúng user.
// Consumer không truy vấn lại credential; event chỉ mang snapshot tối thiểu cần cho email.

import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
    UserEvents,
    UserRoleChangedEvent,
    UserStatusChangedEvent,
} from '@common/kafka/events';
import { EmailService } from '@/modules/email/application/services/email.service';

@Controller()
export class UserStatusConsumer {
    private readonly logger = new Logger(UserStatusConsumer.name);

    constructor(private readonly emailService: EmailService) {}

    // Gửi email sau khi nhận event; lỗi SMTP chỉ được log để Kafka không retry vô hạn làm nghẽn consumer.
    @EventPattern(UserEvents.STATUS_CHANGED)
    async handleStatusChanged(
        @Payload() event: UserStatusChangedEvent,
    ): Promise<void> {
        this.logger.log(
            `Received user status event ${event.eventId} for ${event.data.userId}`,
        );

        try {
            await this.emailService.sendUserStatusChangedEmail({
                to: event.data.email,
                name: event.data.name,
                status: event.data.status,
                reason: event.data.reason,
                occurredAt: event.occurredAt,
            });
        } catch (error) {
            this.logger.error(
                `Failed to send user status email for ${event.data.userId}: ${String(error)}`,
            );
        }
    }

    // Gửi email role riêng với email status để nội dung luôn phản ánh đúng loại thay đổi quyền.
    @EventPattern(UserEvents.ROLE_CHANGED)
    async handleRoleChanged(
        @Payload() event: UserRoleChangedEvent,
    ): Promise<void> {
        this.logger.log(
            `Received user role event ${event.eventId} for ${event.data.userId}`,
        );

        try {
            await this.emailService.sendUserRoleChangedEmail({
                to: event.data.email,
                name: event.data.name,
                previousRole: event.data.previousRole,
                role: event.data.role,
                reason: event.data.reason,
                occurredAt: event.occurredAt,
            });
        } catch (error) {
            this.logger.error(
                `Failed to send user role email for ${event.data.userId}: ${String(error)}`,
            );
        }
    }
}
