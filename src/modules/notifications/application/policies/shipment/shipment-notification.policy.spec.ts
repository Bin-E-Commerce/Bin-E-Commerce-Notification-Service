// File này kiểm tra policy chuyển event shipment thành notification đúng audience và CTA.

/// <reference types="jest" />

import { ShipmentStatusUpdatedEvent } from "@common/kafka/events";
import { NotificationCategory } from "@common/notifications";
import { ShipmentNotificationPolicy } from "./shipment-notification.policy";

describe("ShipmentNotificationPolicy", () => {
  let target: ShipmentNotificationPolicy;

  // Policy không có dependency nên khởi tạo trực tiếp để test tập trung vào mapping contract.
  beforeEach(() => {
    target = new ShipmentNotificationPolicy();
  });

  // Tạo event snapshot nhỏ dùng chung cho hai audience trong các assertion.
  const createEvent = (): ShipmentStatusUpdatedEvent => ({
    eventId: "shipment-event-001",
    eventName: "shipment.status.updated",
    eventVersion: 1,
    aggregateId: "shipment-001",
    occurredAt: "2026-08-30T00:00:00.000Z",
    source: "shipping-service",
    data: {
      shipmentId: "shipment-001",
      orderId: "order-001",
      orderNumber: "BIN-ORDER-001",
      shopId: "shop-001",
      sellerUserId: "seller-001",
      customerUserId: "customer-001",
      trackingCode: "GHN-TEST-00000001",
      status: "IN_TRANSIT",
      statusLabel: "Đang trên đường giao",
      currentLocation: {
        latitude: 10.78,
        longitude: 106.69,
        label: "Trạm trung chuyển Quận 3",
      },
    },
  });

  // Đảm bảo notification customer có badge và action URL dẫn về đúng order detail.
  it("builds a customer notification with customer scope", () => {
    // Arrange
    const event = createEvent();

    // Act
    const result = target.buildForCustomer(event);

    // Assert
    expect(result.category).toBe(NotificationCategory.SHIPPING);
    expect(result.audiences).toEqual([{ type: "user", value: "customer-001" }]);
    expect(result.actionUrl).toBe("/profile/orders/order-001");
    expect(result.badgeKey).toBe("customer.orders");
    expect(result.metadata?.status).toBe("IN_TRANSIT");
  });

  // Đảm bảo notification seller chỉ chứa CTA và recipient của shop đang vận hành.
  it("builds a seller notification with seller scope", () => {
    // Arrange
    const event = createEvent();

    // Act
    const result = target.buildForSeller(event);

    // Assert
    expect(result.audiences).toEqual([{ type: "user", value: "seller-001" }]);
    expect(result.actionUrl).toBe("/seller/orders/order-001");
    expect(result.badgeKey).toBe("seller.orders");
    expect(result.entityId).toBe("shipment-001");
  });
});
