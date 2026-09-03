//
// File này map shipment.status.updated thành notification cho Customer và Seller.
// Policy chỉ quyết định nội dung/audience; deduplication và email side effect thuộc consumer/service.
//

import { Injectable } from '@nestjs/common';
import { ShipmentStatusUpdatedEvent } from '@common/kafka/events';
import {
  NotificationAudienceType,
  NotificationCategory,
  NotificationPriority,
} from '@common/notifications';
import type { CreateNotificationInput } from '../../types/create-notification-input.type';

const RETENTION_DAYS = 90;

@Injectable()
export class ShipmentNotificationPolicy {
  // Tạo notification riêng cho Customer bằng event snapshot, không đọc lại order hoặc địa chỉ.
  buildForCustomer(event: ShipmentStatusUpdatedEvent): CreateNotificationInput {
    return this.buildBase(
      `${event.eventId}:customer:${event.data.customerUserId}`,
      event,
      event.data.customerUserId,
      'Cập nhật hành trình đơn hàng',
      `${this.label(event.data.status)} · ${event.data.currentLocation.label}.`,
      `/profile/orders/${event.data.orderId}`,
      'customer.orders',
      'shipment_status_for_customer',
    );
  }

  // Tạo notification riêng cho Seller sở hữu shipment, không dùng audience shop chưa được hỗ trợ ở feed hiện tại.
  buildForSeller(event: ShipmentStatusUpdatedEvent): CreateNotificationInput {
    return this.buildBase(
      `${event.eventId}:seller:${event.data.sellerUserId}`,
      event,
      event.data.sellerUserId,
      'Cập nhật vận đơn của shop',
      `Vận đơn ${event.data.trackingCode} đã chuyển sang ${this.label(event.data.status)}.`,
      `/seller/orders/${event.data.orderId}`,
      'seller.orders',
      'shipment_status_for_seller',
    );
  }

  // Chuẩn hóa category, priority, metadata và TTL để mọi shipment notification có cùng response shape.
  private buildBase(
    eventId: string,
    event: ShipmentStatusUpdatedEvent,
    userId: string,
    title: string,
    message: string,
    actionUrl: string,
    badgeKey: string,
    type: string,
  ): CreateNotificationInput {
    return {
      eventId,
      eventName: event.eventName,
      eventVersion: event.eventVersion,
      source: event.source,
      category: NotificationCategory.SHIPPING,
      type,
      audiences: [{ type: NotificationAudienceType.USER, value: userId }],
      title,
      message,
      actionUrl,
      badgeKey,
      priority: NotificationPriority.HIGH,
      entityType: 'shipment',
      entityId: event.data.shipmentId,
      metadata: {
        orderId: event.data.orderId,
        trackingCode: event.data.trackingCode,
        status: event.data.status,
      },
      occurredAt: new Date(event.occurredAt),
      expiresAt: this.expiry(event.occurredAt),
    };
  }

  // Giữ label tiếng Việt ở policy để notification và email cùng trình bày một trạng thái.
  private label(status: string): string {
    const labels: Record<string, string> = {
      READY_TO_SHIP: 'Shop đang chuẩn bị hàng',
      PICKUP_ASSIGNED: 'Đã phân công lấy hàng',
      PICKED_UP: 'Đơn vị vận chuyển đã lấy hàng',
      IN_TRANSIT: 'Đang trên đường giao',
      DELIVERED: 'Giao hàng thành công',
      FAILED: 'Giao hàng thất bại',
      CANCELLED: 'Vận đơn đã hủy',
    };
    return labels[status] ?? 'Có cập nhật mới';
  }

  // Tính TTL từ event time để Kafka retry không kéo dài vòng đời notification ngoài 90 ngày.
  private expiry(occurredAt: string): Date {
    const date = new Date(occurredAt);
    date.setUTCDate(date.getUTCDate() + RETENTION_DAYS);
    return date;
  }
}
