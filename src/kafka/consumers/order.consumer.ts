// File này nhận event order.created/order.cancelled, lưu in-app notification và gửi email cho đúng audience.
// Notification được ghi trước; email là side effect độc lập nên SMTP lỗi không làm mất thông báo trong ứng dụng.

import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import {
  OrderCancelledEvent,
  OrderCreatedEvent,
  OrderEvents,
} from "@common/kafka/events";
import { AuthUserEmailClient } from "../../integrations/auth-user-email.client";
import { EmailService } from "../../modules/email/email.service";
import { OrderNotificationPolicy } from "../../modules/notifications/policies/order/order-notification.policy";
import { NotificationsService } from "../../modules/notifications/services/notifications.service";
import type { CreateNotificationInput } from "../../modules/notifications/types/create-notification-input.type";

type OrderCreatedEmailInput = Omit<
  Parameters<EmailService["sendOrderCreatedEmail"]>[0],
  "to"
>;
type OrderCancelledEmailInput = Omit<
  Parameters<EmailService["sendOrderCancelledEmail"]>[0],
  "to"
>;

@Controller()
export class OrderConsumer {
  private readonly logger = new Logger(OrderConsumer.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly policy: OrderNotificationPolicy,
    private readonly emailService: EmailService,
    private readonly userEmailClient: AuthUserEmailClient,
  ) {}

  // Tạo notification/email cho customer và từng seller sau khi order COD được commit thành công.
  @EventPattern(OrderEvents.CREATED)
  async handleCreated(@Payload() event: OrderCreatedEvent): Promise<void> {
    this.logger.log(`Received order created event ${event.eventId}`);

    // Event cũ chỉ có seller recipients; bỏ qua customer branch để replay message cũ không tạo audience rỗng.
    if (event.data.customerUserId) {
      await this.createNotificationAndEmail(
        this.policy.buildCreatedForCustomer(event),
        event.data.customerUserId,
        {
          orderNumber: event.data.orderNumber,
          role: "customer",
          orderUrl: `/profile/orders/${event.data.orderId}`,
          createdAt: event.data.createdAt,
          totalAmount: event.data.totalAmount,
          items: event.data.customerItems,
        },
        event.data.customerEmail,
      );
    }

    for (const recipient of event.data.recipients) {
      await this.createNotificationAndEmail(
        this.policy.buildCreatedForSeller(event, recipient),
        recipient.userId,
        {
          orderNumber: event.data.orderNumber,
          role: "seller",
          orderUrl: `/seller/orders/${event.data.orderId}`,
          createdAt: event.data.createdAt,
          totalAmount: event.data.totalAmount,
          itemCount: recipient.itemCount,
          shopItemTotal: recipient.shopItemTotal,
        },
      );
    }
  }

  // Tạo notification/email khi order chuyển sang CANCELLED; eventId recipient giúp retry không gửi trùng.
  @EventPattern(OrderEvents.CANCELLED)
  async handleCancelled(@Payload() event: OrderCancelledEvent): Promise<void> {
    this.logger.log(`Received order cancelled event ${event.eventId}`);

    await this.createNotificationAndEmail(
      this.policy.buildCancelledForCustomer(event),
      event.data.customerUserId,
      {
        orderNumber: event.data.orderNumber,
        role: "customer",
        orderUrl: `/profile/orders/${event.data.orderId}`,
        createdAt: event.data.createdAt,
        totalAmount: event.data.totalAmount,
        cancelledAt: event.data.cancelledAt,
        cancelReason: event.data.cancelReason,
        items: event.data.customerItems,
      },
      event.data.customerEmail,
    );

    for (const recipient of event.data.recipients) {
      await this.createNotificationAndEmail(
        this.policy.buildCancelledForSeller(event, recipient),
        recipient.userId,
        {
          orderNumber: event.data.orderNumber,
          role: "seller",
          orderUrl: `/seller/orders/${event.data.orderId}`,
          createdAt: event.data.createdAt,
          totalAmount: event.data.totalAmount,
          cancelledAt: event.data.cancelledAt,
          cancelReason: event.data.cancelReason,
          itemCount: recipient.itemCount,
          shopItemTotal: recipient.shopItemTotal,
        },
      );
    }
  }

  // Chỉ gửi email khi notification vừa được tạo; notification-service dùng eventId unique để chống Kafka redelivery gửi trùng.
  private async createNotificationAndEmail(
    input: CreateNotificationInput,
    userId: string,
    emailInput: OrderCreatedEmailInput | OrderCancelledEmailInput,
    emailOverride?: string | null,
  ): Promise<void> {
    const result = await this.notifications.createFromEvent(input);
    if (!result.created) return;

    try {
      const email =
        emailOverride?.trim().toLowerCase() ||
        (await this.userEmailClient.getEmail(userId));
      if (!email) {
        this.logger.warn(`No email found for order notification user ${userId}`);
        return;
      }

      if (input.type.includes("created")) {
        await this.emailService.sendOrderCreatedEmail({
          ...emailInput,
          to: email,
        } as Parameters<EmailService["sendOrderCreatedEmail"]>[0]);
      } else {
        await this.emailService.sendOrderCancelledEmail({
          ...emailInput,
          to: email,
        } as Parameters<EmailService["sendOrderCancelledEmail"]>[0]);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send order email for ${input.entityId} to ${userId}: ${String(error)}`,
      );
    }
  }
}
