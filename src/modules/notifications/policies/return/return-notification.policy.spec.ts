// File này kiểm tra policy tạo nội dung notification seller theo từng return event.

/// <reference types="jest" />

import { OrderEvents, ReturnChangedEvent } from "@common/kafka/events";
import { NotificationAudienceType } from "@common/notifications";
import { ReturnNotificationPolicy } from "./return-notification.policy";

describe("ReturnNotificationPolicy", () => {
  let target: ReturnNotificationPolicy;

  // Policy không có dependency nên khởi tạo trực tiếp để test tập trung vào mapping nội dung.
  beforeEach(() => {
    target = new ReturnNotificationPolicy();
  });

  // Tạo event snapshot tối thiểu để các test chỉ thay đổi eventName và status cần kiểm tra.
  const createEvent = (
    eventName: ReturnChangedEvent["eventName"],
    status: string,
  ): ReturnChangedEvent => ({
    eventId: `return-event-${status}`,
    eventName,
    eventVersion: 1,
    source: "order-service",
    occurredAt: "2026-09-03T10:00:00.000Z",
    aggregateId: "return-001",
    data: {
      returnId: "return-001",
      orderId: "order-001",
      orderNumber: "BIN-ORDER-001",
      shopId: "shop-001",
      customerUserId: "customer-001",
      sellerUserId: "seller-001",
      status,
      refundAmount: "200000.00",
      reason: "DAMAGED",
      note: "Sản phẩm bị lỗi",
    },
  });

  // Seller phải nhận được nội dung khác nhau cho các event xử lý chính, không bị gắn nhãn request mới cố định.
  it.each([
    [OrderEvents.RETURN_REQUESTED, "REQUESTED", "Yêu cầu hoàn hàng mới"],
    [OrderEvents.RETURN_APPROVED, "AWAITING_SHIPMENT", "Yêu cầu hoàn hàng đã được duyệt"],
    [OrderEvents.RETURN_REJECTED, "REJECTED", "Yêu cầu hoàn hàng bị từ chối"],
    [OrderEvents.RETURN_RECEIVED, "RECEIVED", "Shop đã nhận hàng hoàn"],
  ])("builds seller title for %s", (eventName, status, expectedTitle) => {
    // Arrange
    const event = createEvent(eventName, status);

    // Act
    const result = target.buildForSeller(event);

    // Assert
    expect(result).not.toBeNull();
    expect(result?.title).toBe(expectedTitle);
    expect(result?.audiences).toEqual([
      { type: NotificationAudienceType.USER, value: "seller-001" },
    ]);
  });
});
