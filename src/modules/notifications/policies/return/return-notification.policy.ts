// File này map return integration event thành notification cho đúng audience.
// Policy chỉ tạo nội dung và action URL, không chứa state transition hay quyền truy cập.

import { Injectable } from "@nestjs/common";
import { ReturnChangedEvent } from "@common/kafka/events";
import { NotificationAudienceType, NotificationCategory, NotificationPriority } from "@common/notifications";
import type { CreateNotificationInput } from "../../types/create-notification-input.type";

@Injectable()
export class ReturnNotificationPolicy {
  // Tạo một notification cho customer và một notification cho seller nếu event có seller recipient.
  buildForCustomer(event: ReturnChangedEvent): CreateNotificationInput {
    return this.build(event, event.data.customerUserId, "customer");
  }

  buildForSeller(event: ReturnChangedEvent): CreateNotificationInput | null {
    return event.data.sellerUserId ? this.build(event, event.data.sellerUserId, "seller") : null;
  }

  private build(event: ReturnChangedEvent, userId: string, audience: "customer" | "seller"): CreateNotificationInput {
    const title = audience === "seller" ? "Yêu cầu hoàn hàng mới" : "Cập nhật yêu cầu hoàn hàng";
    const status = this.statusLabel(event.data.status);
    const reason = this.reasonLabel(event.data.reason);
    const message = audience === "seller"
        ? `Khách hàng yêu cầu hoàn hàng #${event.data.orderNumber}. Lý do: ${reason}. Số tiền dự kiến: ${event.data.refundAmount} đ.`
        : `Yêu cầu hoàn hàng #${event.data.orderNumber} đang ở trạng thái ${status}.`;
    return {
      eventId: `${event.eventId}:${audience}:${userId}`,
      eventName: event.eventName,
      eventVersion: event.eventVersion,
      source: event.source,
      category: NotificationCategory.ORDER,
      type: `return_${audience}`,
      audiences: [{ type: NotificationAudienceType.USER, value: userId }],
      title,
      message,
      actionUrl: audience === "seller" ? "/seller/returns" : `/profile/orders/${event.data.orderId}`,
      badgeKey: audience === "seller" ? "seller.returns" : "customer.orders",
      priority: NotificationPriority.HIGH,
      entityType: "return",
      entityId: event.data.returnId,
      metadata: {
        orderId: event.data.orderId,
        shopId: event.data.shopId,
        status: event.data.status,
        reason,
        refundAmount: event.data.refundAmount,
      },
      occurredAt: new Date(event.occurredAt),
      expiresAt: this.expiry(event.occurredAt),
    };
  }

  private statusLabel(status: string): string {
    const labels: Record<string, string> = {
      REQUESTED: "đã được tiếp nhận", APPROVED: "đã được duyệt", AWAITING_SHIPMENT: "đang chờ gửi hàng",
      IN_TRANSIT: "đang hoàn về shop", RECEIVED: "đã nhận hàng hoàn",
      REFUND_PENDING: "đã kiểm tra đạt, đang chờ hoàn tiền",
      REJECTED: "bị từ chối",
      INSPECTION_FAILED: "kiểm tra không đạt, chờ gửi trả sản phẩm",
      CUSTOMER_CANCELLED: "đã hủy",
    };
    return labels[status] ?? "đang được xử lý";
  }

  // Chuyển mã lý do hoàn hàng thành nhãn tiếng Việt để notification không lộ enum kỹ thuật.
  private reasonLabel(reason: string): string {
    const labels: Record<string, string> = {
      DAMAGED: "sản phẩm bị hư hỏng",
      WRONG_ITEM: "giao sai sản phẩm",
      MISSING_ITEM: "thiếu sản phẩm",
      NOT_AS_DESCRIBED: "sản phẩm không đúng mô tả",
      CHANGE_OF_MIND: "không còn nhu cầu",
      NOT_RECEIVED: "chưa nhận được hàng",
      OTHER: "lý do khác",
    };

    return labels[reason] ?? "lý do khác";
  }

  private expiry(occurredAt: string): Date {
    const expiry = new Date(occurredAt);
    expiry.setUTCDate(expiry.getUTCDate() + 90);
    return expiry;
  }
}
