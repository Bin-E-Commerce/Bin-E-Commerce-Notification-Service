// File này chuyển event order thành notification riêng cho customer và seller.
// Policy chỉ tạo nội dung hiển thị, không gửi email và không quyết định quyền truy cập order.

import { Injectable } from "@nestjs/common";
import {
  OrderCancelledEvent,
  OrderCreatedEvent,
  OrderSellerRecipient,
} from "@common/kafka/events";
import {
  NotificationAudienceType,
  NotificationCategory,
  NotificationPriority,
} from "@common/notifications";
import { CreateNotificationInput } from "../../types/create-notification-input.type";

const NOTIFICATION_RETENTION_DAYS = 90;

@Injectable()
export class OrderNotificationPolicy {
  // Tạo notification cho customer sau khi order COD được xác nhận và tồn kho đã được giữ thành công.
  buildCreatedForCustomer(event: OrderCreatedEvent): CreateNotificationInput {
    return this.buildBase(
      `${event.eventId}:customer:${event.data.customerUserId}`,
      event,
      event.data.customerUserId,
      "Đặt hàng thành công",
      `Đơn #${event.data.orderNumber} đã được xác nhận và đang được chuẩn bị.`,
      `/profile/orders/${event.data.orderId}`,
      "customer.orders",
      "order_created_for_customer",
      { paymentMethod: event.data.paymentMethod },
    );
  }

  // Tạo notification riêng cho từng seller có sản phẩm trong order để không lộ dữ liệu shop khác.
  buildCreatedForSeller(
    event: OrderCreatedEvent,
    recipient: OrderSellerRecipient,
  ): CreateNotificationInput {
    const itemSummary = this.buildItemSummary(recipient);
    return this.buildBase(
      `${event.eventId}:seller:${recipient.userId}:${recipient.shopId}`,
      event,
      recipient.userId,
      "Bạn có đơn hàng mới",
      `Đơn #${event.data.orderNumber} gồm ${itemSummary}.`,
      `/seller/orders/${event.data.orderId}`,
      "seller.orders",
      "order_created_for_seller",
      {
        shopId: recipient.shopId,
        itemCount: recipient.itemCount,
        shopItemTotal: recipient.shopItemTotal,
        paymentMethod: event.data.paymentMethod,
      },
    );
  }

  // Tạo notification cho customer ngay sau khi order chuyển sang CANCELLED và lưu lý do hủy nếu có.
  buildCancelledForCustomer(
    event: OrderCancelledEvent,
  ): CreateNotificationInput {
    const reason = event.data.cancelReason
      ? ` Lý do: ${event.data.cancelReason}.`
      : "";
    return this.buildBase(
      `${event.eventId}:customer:${event.data.customerUserId}`,
      event,
      event.data.customerUserId,
      "Đơn hàng đã được hủy",
      `Đơn #${event.data.orderNumber} đã được hủy.${reason}`,
      `/profile/orders/${event.data.orderId}`,
      "customer.orders",
      "order_cancelled_for_customer",
      {
        paymentMethod: event.data.paymentMethod,
        cancelReason: event.data.cancelReason,
      },
    );
  }

  // Tạo notification cho seller để seller biết order thuộc shop mình đã bị customer hủy.
  buildCancelledForSeller(
    event: OrderCancelledEvent,
    recipient: OrderSellerRecipient,
  ): CreateNotificationInput {
    const reason = event.data.cancelReason
      ? ` Lý do: ${event.data.cancelReason}.`
      : "";
    return this.buildBase(
      `${event.eventId}:seller:${recipient.userId}:${recipient.shopId}`,
      event,
      recipient.userId,
      "Đơn hàng đã bị hủy",
      `Đơn #${event.data.orderNumber} của shop đã được customer hủy.${reason}`,
      `/seller/orders/${event.data.orderId}`,
      "seller.orders",
      "order_cancelled_for_seller",
      {
        shopId: recipient.shopId,
        itemCount: recipient.itemCount,
        shopItemTotal: recipient.shopItemTotal,
        cancelReason: event.data.cancelReason,
      },
    );
  }

  // Dùng chung các trường notification để event tạo customer/seller không bị lệch TTL hoặc mức ưu tiên.
  private buildBase(
    eventId: string,
    event: OrderCreatedEvent | OrderCancelledEvent,
    userId: string,
    title: string,
    message: string,
    actionUrl: string,
    badgeKey: string,
    type: string,
    metadata: Record<string, unknown>,
  ): CreateNotificationInput {
    return {
      eventId,
      eventName: event.eventName,
      eventVersion: event.eventVersion,
      source: event.source,
      category: NotificationCategory.ORDER,
      type,
      audiences: [
        {
          type: NotificationAudienceType.USER,
          value: userId,
        },
      ],
      title,
      message,
      actionUrl,
      badgeKey,
      priority: NotificationPriority.HIGH,
      entityType: "order",
      entityId: event.data.orderId,
      metadata,
      occurredAt: new Date(event.occurredAt),
      expiresAt: this.createExpiryDate(event.occurredAt),
    };
  }

  // Rút gọn preview item thành câu dễ đọc trong notification mà vẫn thể hiện số lượng.
  private buildItemSummary(recipient: OrderSellerRecipient): string {
    return recipient.itemCount === 1
      ? recipient.previewProductName
      : `${recipient.previewProductName} và ${recipient.itemCount - 1} sản phẩm khác`;
  }

  // Tính TTL từ thời điểm event để Kafka retry trễ không kéo dài vòng đời notification.
  private createExpiryDate(occurredAt: string): Date {
    const expiresAt = new Date(occurredAt);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + NOTIFICATION_RETENTION_DAYS);
    return expiresAt;
  }
}
