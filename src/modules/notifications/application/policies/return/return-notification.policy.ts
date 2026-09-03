// File này map return integration event thành notification cho đúng audience.
// Policy chỉ tạo nội dung và action URL, không chứa state transition hay quyền truy cập.

import { Injectable } from "@nestjs/common";
import { OrderEvents, ReturnChangedEvent } from "@common/kafka/events";
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
    const status = this.statusLabel(event.data.status);
    const reason = this.reasonLabel(event.data.reason);
    // Seller cần biết đúng hành động vừa xảy ra; không dùng một title cố định
    // vì event approve/reject/received đều đi qua cùng policy này.
    const sellerContent = audience === "seller"
      ? this.buildSellerContent(event, status, reason)
      : null;
    return {
      eventId: `${event.eventId}:${audience}:${userId}`,
      eventName: event.eventName,
      eventVersion: event.eventVersion,
      source: event.source,
      category: NotificationCategory.ORDER,
      type: `return_${audience}`,
      audiences: [{ type: NotificationAudienceType.USER, value: userId }],
      title: sellerContent?.title ?? "Cập nhật yêu cầu hoàn hàng",
      message: sellerContent?.message ?? `Yêu cầu hoàn hàng #${event.data.orderNumber} đang ở trạng thái ${status}.`,
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

  // Chuyển từng return event thành nội dung seller có thể hành động được.
  // Mapping theo eventName giữ đúng ngữ nghĩa approve/reject/received dù status
  // nội bộ có thể là trạng thái trung gian như AWAITING_SHIPMENT hoặc REFUND_PENDING.
  private buildSellerContent(
    event: ReturnChangedEvent,
    status: string,
    reason: string,
  ): { title: string; message: string } {
    const orderNumber = `#${event.data.orderNumber}`;
    switch (event.eventName) {
      case OrderEvents.RETURN_REQUESTED:
        return {
          title: "Yêu cầu hoàn hàng mới",
          message: `Khách hàng yêu cầu hoàn hàng ${orderNumber}. Lý do: ${reason}. Số tiền dự kiến: ${event.data.refundAmount} đ.`,
        };
      case OrderEvents.RETURN_APPROVED:
        return {
          title: "Yêu cầu hoàn hàng đã được duyệt",
          message: `Yêu cầu hoàn hàng ${orderNumber} đã được duyệt và đang chờ khách gửi hàng.`,
        };
      case OrderEvents.RETURN_REJECTED:
        return {
          title: "Yêu cầu hoàn hàng bị từ chối",
          message: `Yêu cầu hoàn hàng ${orderNumber} đã bị từ chối${event.data.note ? `. Lý do: ${event.data.note}` : "."}`,
        };
      case OrderEvents.RETURN_CANCELLED:
        return {
          title: "Yêu cầu hoàn hàng đã được hủy",
          message: `Khách hàng đã hủy yêu cầu hoàn hàng ${orderNumber}.`,
        };
      case OrderEvents.RETURN_IN_TRANSIT:
        return {
          title: "Hàng hoàn đang được vận chuyển",
          message: `Kiện hàng hoàn của đơn ${orderNumber} đang được vận chuyển về shop.`,
        };
      case OrderEvents.RETURN_RECEIVED:
        return {
          title: "Shop đã nhận hàng hoàn",
          message: `Shop đã nhận kiện hàng hoàn của đơn ${orderNumber}. Vui lòng kiểm tra sản phẩm.`,
        };
      case OrderEvents.RETURN_INSPECTION_PASSED:
        return {
          title: "Đã kiểm tra hàng hoàn đạt",
          message: `Sản phẩm hoàn của đơn ${orderNumber} đã được kiểm tra đạt và đang chờ hoàn tiền.`,
        };
      case OrderEvents.RETURN_INSPECTION_FAILED:
        return {
          title: "Kiểm tra hàng hoàn không đạt",
          message: `Sản phẩm hoàn của đơn ${orderNumber} không đạt yêu cầu kiểm tra.`,
        };
      default:
        return {
          title: "Cập nhật yêu cầu hoàn hàng",
          message: `Yêu cầu hoàn hàng ${orderNumber} đang ở trạng thái ${status}.`,
        };
    }
  }

  private statusLabel(status: string): string {
    const labels: Record<string, string> = {
      REQUESTED: "đã được tiếp nhận", APPROVED: "đã được duyệt", AWAITING_SHIPMENT: "đang chờ gửi hàng",
      IN_TRANSIT: "đang hoàn về shop", RECEIVED: "đã nhận hàng hoàn",
      REFUND_PENDING: "đã kiểm tra đạt, đang chờ hoàn tiền",
      INSPECTION_PASSED: "đã kiểm tra đạt, đang chờ hoàn tiền",
      REJECTED: "bị từ chối",
      INSPECTION_FAILED: "kiểm tra không đạt, chờ gửi trả sản phẩm",
      REFUND_FAILED: "hoàn tiền thất bại",
      REFUNDED: "đã hoàn tiền",
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
