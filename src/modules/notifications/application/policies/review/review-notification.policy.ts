// Policy nay map review.created thanh notification rieng cho seller so seller nhan dung phan hoi cua shop minh.
import { Injectable } from "@nestjs/common";
import { ReviewCreatedEvent, ReviewEvents, ReviewUpdatedEvent } from "@common/kafka/events";
import {
  NotificationAudienceType,
  NotificationCategory,
  NotificationPriority,
} from "@common/notifications";
import { CreateNotificationInput } from "../../types/create-notification-input.type";

const RETENTION_DAYS = 90;

@Injectable()
export class ReviewNotificationPolicy {
  // Tao notification cho seller sau khi review da duoc Product Service luu thanh cong.
  // Tạo notification khác nhau cho review mới và review chỉnh sửa nhưng vẫn dùng chung CTA tới sản phẩm.
  buildForSeller(event: ReviewCreatedEvent | ReviewUpdatedEvent): CreateNotificationInput {
    const reviewer = event.data.reviewerName?.trim() || "Khách hàng";
    const mediaText = event.data.mediaCount > 0 ? ` Có ${event.data.mediaCount} tệp đính kèm.` : "";
    const commentText = event.data.hasComment ? " có nội dung phản hồi" : "";
    const isUpdated = event.eventName === ReviewEvents.UPDATED;

    return {
      eventId: `${event.eventId}:seller:${event.data.sellerUserId}`,
      eventName: event.eventName,
      eventVersion: event.eventVersion,
      source: event.source,
      category: NotificationCategory.PRODUCT_REVIEW,
      type: isUpdated ? "product_review_updated_for_seller" : "product_review_created_for_seller",
      audiences: [
        {
          type: NotificationAudienceType.USER,
          value: event.data.sellerUserId,
        },
      ],
      title: isUpdated ? "Đánh giá sản phẩm đã được cập nhật" : "Sản phẩm có đánh giá mới",
      message: isUpdated
        ? `${reviewer} đã cập nhật đánh giá ${event.data.rating}/5 sao cho ${event.data.productName}${commentText}.${mediaText}`
        : `${reviewer} đã đánh giá ${event.data.rating}/5 sao cho ${event.data.productName}${commentText}.${mediaText}`,
      actionUrl: `/seller/products/${event.data.productId}#product-reviews`,
      badgeKey: "seller.products",
      priority: NotificationPriority.NORMAL,
      entityType: "product_review",
      entityId: event.data.reviewId,
      metadata: {
        productId: event.data.productId,
        orderId: event.data.orderId,
        rating: event.data.rating,
        mediaCount: event.data.mediaCount,
      },
      occurredAt: new Date(event.occurredAt),
      expiresAt: this.expiry(event.occurredAt),
    };
  }

  // Tinh thoi han luu notification theo event time de replay Kafka khong keo dai TTL.
  private expiry(occurredAt: string): Date {
    const expiresAt = new Date(occurredAt);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + RETENTION_DAYS);
    return expiresAt;
  }
}
