// Unit test cho policy review, tap trung vao audience seller va CTA ve dung product detail.
/// <reference types="jest" />
import { ReviewCreatedEvent, ReviewEvents, ReviewUpdatedEvent } from "@common/kafka/events";
import { NotificationAudienceType, NotificationCategory } from "@common/notifications";
import { ReviewNotificationPolicy } from "./review-notification.policy";

describe("ReviewNotificationPolicy", () => {
  const target = new ReviewNotificationPolicy();

  const createEvent = (): ReviewCreatedEvent => ({
    eventId: "review-created-001",
    eventName: "review.created",
    eventVersion: 1,
    source: "product-service",
    occurredAt: "2026-09-01T01:00:00.000Z",
    aggregateId: "review-001",
    data: {
      reviewId: "review-001",
      productId: "product-001",
      productName: "Ao so mi den",
      sellerUserId: "seller-001",
      customerUserId: "customer-001",
      orderId: "order-001",
      rating: 5,
      reviewerName: "Nguyen Van A",
      isAnonymous: false,
      hasComment: true,
      mediaCount: 2,
      createdAt: "2026-09-01T01:00:00.000Z",
    },
  });

  it("builds a seller notification for a new review", () => {
    const result = target.buildForSeller(createEvent());

    expect(result.category).toBe(NotificationCategory.PRODUCT_REVIEW);
    expect(result.audiences).toEqual([
      { type: NotificationAudienceType.USER, value: "seller-001" },
    ]);
    expect(result.actionUrl).toBe("/seller/products/product-001#product-reviews");
    expect(result.badgeKey).toBe("seller.products");
    expect(result.message).toContain("Nguyen Van A");
    expect(result.metadata?.mediaCount).toBe(2);
  });

  // Đảm bảo review chỉnh sửa tạo notification riêng nhưng vẫn giữ đúng Seller audience và CTA.
  it("builds an update notification for a seller", () => {
    // Arrange
    const event = {
      ...createEvent(),
      eventId: "review-updated-001",
      eventName: ReviewEvents.UPDATED,
    } as ReviewUpdatedEvent;

    // Act
    const result = target.buildForSeller(event);

    // Assert
    expect(result.type).toBe("product_review_updated_for_seller");
    expect(result.title).toBe("Đánh giá sản phẩm đã được cập nhật");
    expect(result.message).toContain("đã cập nhật đánh giá");
    expect(result.audiences).toEqual([
      { type: NotificationAudienceType.USER, value: "seller-001" },
    ]);
  });
});
