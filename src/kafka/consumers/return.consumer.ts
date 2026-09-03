// File này nhận event return và ghi notification idempotent cho customer, seller.
// Kafka redelivery được xử lý bởi eventId trong NotificationsService.

import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { OrderEvents, ReturnChangedEvent } from "@common/kafka/events";
import { AuthUserEmailClient } from "../../integrations/auth-user-email.client";
import { EmailService } from "../../modules/email/application/services/email.service";
import { ReturnNotificationPolicy } from "../../modules/notifications/application/policies/return/return-notification.policy";
import { NotificationsService } from "../../modules/notifications/application/services/notifications.service";

@Controller()
export class ReturnConsumer {
  private readonly logger = new Logger(ReturnConsumer.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly policy: ReturnNotificationPolicy,
    private readonly emailService: EmailService,
    private readonly userEmailClient: AuthUserEmailClient,
  ) {}

  // Đăng ký riêng từng pattern để NestJS không ghi đè metadata khi có nhiều event dùng chung một method.
  @EventPattern(OrderEvents.RETURN_REQUESTED)
  async handleRequested(@Payload() event: ReturnChangedEvent): Promise<void> {
    await this.handleEvent(event);
  }

  // Gửi email cho customer ngay sau khi Seller chấp nhận yêu cầu hoàn hàng.
  @EventPattern(OrderEvents.RETURN_APPROVED)
  async handleApproved(@Payload() event: ReturnChangedEvent): Promise<void> {
    await this.handleEvent(event);
  }

  // Gửi notification và email thông báo Seller từ chối yêu cầu hoàn hàng cho customer.
  @EventPattern(OrderEvents.RETURN_REJECTED)
  async handleRejected(@Payload() event: ReturnChangedEvent): Promise<void> {
    await this.handleEvent(event);
  }

  // Thông báo cho các bên khi customer hủy yêu cầu hoàn hàng.
  @EventPattern(OrderEvents.RETURN_CANCELLED)
  async handleCancelled(@Payload() event: ReturnChangedEvent): Promise<void> {
    await this.handleEvent(event);
  }

  // Thông báo khi kiện hàng hoàn bắt đầu được vận chuyển về shop.
  @EventPattern(OrderEvents.RETURN_IN_TRANSIT)
  async handleInTransit(@Payload() event: ReturnChangedEvent): Promise<void> {
    await this.handleEvent(event);
  }

  // Thông báo khi shop đã nhận kiện hàng hoàn.
  @EventPattern(OrderEvents.RETURN_RECEIVED)
  async handleReceived(@Payload() event: ReturnChangedEvent): Promise<void> {
    await this.handleEvent(event);
  }

  // Thông báo khi shop kiểm tra kiện hàng hoàn đạt yêu cầu.
  @EventPattern(OrderEvents.RETURN_INSPECTION_PASSED)
  async handleInspectionPassed(@Payload() event: ReturnChangedEvent): Promise<void> {
    await this.handleEvent(event);
  }

  // Thông báo khi shop kiểm tra kiện hàng hoàn không đạt yêu cầu.
  @EventPattern(OrderEvents.RETURN_INSPECTION_FAILED)
  async handleInspectionFailed(@Payload() event: ReturnChangedEvent): Promise<void> {
    await this.handleEvent(event);
  }

  // Xử lý chung việc lưu notification và gửi email cho đúng customer hoặc seller.
  private async handleEvent(event: ReturnChangedEvent): Promise<void> {
    this.logger.log(`Received return event ${event.eventId}`);

    // Tạo notification trước; chỉ gửi email khi notification mới được tạo để Kafka redelivery không gửi thư trùng.
    await this.notifyUser(
      event,
      this.policy.buildForCustomer(event),
      event.data.customerUserId,
      "customer",
    );
    const sellerNotification = this.policy.buildForSeller(event);
    if (sellerNotification && event.data.sellerUserId) {
      await this.notifyUser(
        event,
        sellerNotification,
        event.data.sellerUserId,
        "seller",
      );
    }
  }

  // Gửi email độc lập với notification; lỗi SMTP chỉ được log để không làm mất notification in-app hoặc retry Kafka vô hạn.
  private async notifyUser(
    event: ReturnChangedEvent,
    input: Parameters<NotificationsService["createFromEvent"]>[0],
    userId: string,
    role: "customer" | "seller",
  ): Promise<void> {
    const result = await this.notifications.createFromEvent(input);
    if (!result.created) return;

    try {
      const email = await this.userEmailClient.getEmail(userId);
      if (!email) {
        this.logger.warn(`No email found for return notification user ${userId}`);
        return;
      }

      await this.emailService.sendReturnStatusEmail({
        to: email,
        orderNumber: event.data.orderNumber,
        status: event.data.status,
        reason: event.data.reason,
        refundAmount: event.data.refundAmount,
        note: event.data.note,
        occurredAt: event.occurredAt,
        orderUrl: input.actionUrl ?? "/",
        eventName: event.eventName,
        role,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send return email to ${userId}: ${String(error)}`,
      );
    }
  }
}
