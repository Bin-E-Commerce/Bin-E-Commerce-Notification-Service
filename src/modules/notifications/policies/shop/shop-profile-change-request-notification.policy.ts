import { Injectable } from "@nestjs/common";
import { Permission } from "@common/auth";
import {
  SellerShopProfileChangeRequestedEvent,
  SellerShopProfileChangeReviewedEvent,
} from "@common/kafka/events";
import {
  NotificationAudienceType,
  NotificationCategory,
  NotificationPriority,
} from "@common/notifications";
import { CreateNotificationInput } from "../../types/create-notification-input.type";

const NOTIFICATION_RETENTION_DAYS = 90;

const SECTION_LABELS: Record<string, string> = {
  tax: "thuế",
  payout: "thanh toán",
  identity: "định danh",
};

@Injectable()
export class ShopProfileChangeRequestNotificationPolicy {
  // Tạo thông báo cho mọi tài khoản đang có quyền đọc yêu cầu thay đổi; audience theo permission giúp việc cấp quyền trong DB có hiệu lực mà không sửa consumer.
  buildRequested(
    event: SellerShopProfileChangeRequestedEvent,
  ): CreateNotificationInput {
    const sectionSummary = event.data.sections
      .map((section) => SECTION_LABELS[section] ?? section)
      .join(", ");

    return {
      eventId: event.eventId,
      eventName: event.eventName,
      eventVersion: event.eventVersion,
      source: event.source,
      category: NotificationCategory.SHOP_PROFILE,
      type: "shop_profile_change_requested",
      audiences: [
        {
          type: NotificationAudienceType.PERMISSION,
          value: Permission.ADMIN_SHOP_PROFILE_CHANGE_REQUEST_READ,
        },
      ],
      title: "Có yêu cầu cập nhật hồ sơ shop",
      message: `${event.data.shopName} vừa gửi thay đổi ${sectionSummary} và đang chờ kiểm tra.`,
      actionUrl: `/admin/sellers/profile-changes/${event.data.requestId}`,
      // Badge key trùng mã navigation do backend cấp để chuông và sidebar tăng cùng một số lượng chưa đọc.
      badgeKey: "admin.shop_profile_changes",
      priority: NotificationPriority.HIGH,
      entityType: "shop_profile_change_request",
      entityId: event.data.requestId,
      metadata: {
        shopId: event.data.shopId,
        sections: event.data.sections,
      },
      occurredAt: new Date(event.occurredAt),
      expiresAt: this.createExpiryDate(event.occurredAt),
    };
  }

  // Tạo thông báo riêng cho chủ shop sau khi thay đổi được áp dụng; audience USER ngăn seller khác đọc kết quả này.
  buildApproved(
    event: SellerShopProfileChangeReviewedEvent,
  ): CreateNotificationInput {
    return {
      eventId: event.eventId,
      eventName: event.eventName,
      eventVersion: event.eventVersion,
      source: event.source,
      category: NotificationCategory.SHOP_PROFILE,
      type: "shop_profile_change_approved",
      audiences: [
        {
          type: NotificationAudienceType.USER,
          value: event.data.requesterUserId,
        },
      ],
      title: "Thay đổi hồ sơ shop đã được duyệt",
      message: `${event.data.shopName} đã cập nhật thành công ${this.getSectionSummary(event.data.sections)}.`,
      actionUrl: "/seller/shop",
      badgeKey: "seller.shop_profile",
      priority: NotificationPriority.HIGH,
      entityType: "shop_profile_change_request",
      entityId: event.data.requestId,
      metadata: {
        shopId: event.data.shopId,
        sections: event.data.sections,
        decision: "approved",
      },
      occurredAt: new Date(event.occurredAt),
      expiresAt: this.createExpiryDate(event.occurredAt),
    };
  }

  // Tạo phản hồi từ chối có ghi chú ngắn để seller hiểu quyết định ngay trên chuông và mở hồ sơ shop để xem lại.
  buildRejected(
    event: SellerShopProfileChangeReviewedEvent,
  ): CreateNotificationInput {
    const reviewNote = event.data.reviewNote?.trim();
    const reason = reviewNote
      ? ` Phản hồi: ${this.truncate(reviewNote, 180)}`
      : " Vui lòng kiểm tra lại thông tin đã gửi.";

    return {
      eventId: event.eventId,
      eventName: event.eventName,
      eventVersion: event.eventVersion,
      source: event.source,
      category: NotificationCategory.SHOP_PROFILE,
      type: "shop_profile_change_rejected",
      audiences: [
        {
          type: NotificationAudienceType.USER,
          value: event.data.requesterUserId,
        },
      ],
      title: "Yêu cầu thay đổi hồ sơ cần xem lại",
      message: `${event.data.shopName} chưa thể cập nhật ${this.getSectionSummary(event.data.sections)}.${reason}`,
      actionUrl: "/seller/shop",
      badgeKey: "seller.shop_profile",
      priority: NotificationPriority.HIGH,
      entityType: "shop_profile_change_request",
      entityId: event.data.requestId,
      metadata: {
        shopId: event.data.shopId,
        sections: event.data.sections,
        decision: "rejected",
      },
      occurredAt: new Date(event.occurredAt),
      expiresAt: this.createExpiryDate(event.occurredAt),
    };
  }

  // Chuyển mã section kỹ thuật thành cụm từ ngắn, dễ đọc trong nội dung thông báo.
  private getSectionSummary(sections: string[]): string {
    return sections
      .map((section) => SECTION_LABELS[section] ?? section)
      .join(", ");
  }

  // Giới hạn ghi chú hiển thị trong popover để một phản hồi dài không phá bố cục notification feed.
  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength - 3).trimEnd()}...`;
  }

  // Tính TTL từ thời điểm nghiệp vụ để retry Kafka không làm kéo dài vòng đời thông báo ngoài chính sách lưu 90 ngày.
  private createExpiryDate(occurredAt: string): Date {
    const expiresAt = new Date(occurredAt);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + NOTIFICATION_RETENTION_DAYS);
    return expiresAt;
  }
}
