import { Injectable } from "@nestjs/common";
import { Permission } from "@common/auth";
import {
  SellerApplicationReviewedEvent,
  SellerApplicationSubmittedEvent,
} from "@common/kafka/events";
import {
  NotificationAudienceType,
  NotificationCategory,
  NotificationPriority,
} from "@common/notifications";
import { CreateNotificationInput } from "../types/create-notification-input.type";

const NOTIFICATION_RETENTION_DAYS = 90;

@Injectable()
export class SellerApplicationNotificationPolicy {
  // Tạo notification cho nhân sự có quyền đọc hồ sơ; role cụ thể không bị hard-code nên phân quyền DB vẫn là nguồn quyết định.
  buildSubmitted(
    event: SellerApplicationSubmittedEvent,
  ): CreateNotificationInput {
    return {
      eventId: event.eventId,
      eventName: event.eventName,
      eventVersion: event.eventVersion,
      source: event.source,
      category: NotificationCategory.SELLER_APPLICATION,
      type: "seller_application_submitted",
      audiences: [
        {
          type: NotificationAudienceType.PERMISSION,
          value: Permission.SELLER_APPLICATION_READ,
        },
      ],
      title: "Có hồ sơ người bán mới",
      message: `${event.data.shopName} vừa gửi hồ sơ đăng ký và đang chờ kiểm tra.`,
      actionUrl: `/admin/sellers/applications/${event.data.applicationId}`,
      // Badge key trùng navigation code để sidebar render count mà không hard-code route ở frontend.
      badgeKey: "admin.seller_applications",
      priority: NotificationPriority.HIGH,
      entityType: "seller_application",
      entityId: event.data.applicationId,
      metadata: {
        submissionRevision: event.data.submissionRevision,
      },
      occurredAt: new Date(event.occurredAt),
      expiresAt: this.createExpiryDate(event.occurredAt),
    };
  }

  // Tạo phản hồi riêng cho seller; nội dung realtime không chứa ảnh giấy tờ hoặc mã định danh nhạy cảm.
  buildRejected(
    event: SellerApplicationReviewedEvent,
  ): CreateNotificationInput {
    return {
      eventId: event.eventId,
      eventName: event.eventName,
      eventVersion: event.eventVersion,
      source: event.source,
      category: NotificationCategory.SELLER_APPLICATION,
      type: "seller_application_rejected",
      audiences: [
        {
          type: NotificationAudienceType.USER,
          value: event.data.userId,
        },
      ],
      title: "Hồ sơ cần được cập nhật",
      message: `${event.data.shopName} có phản hồi mới từ bộ phận xét duyệt.`,
      actionUrl: "/seller/register",
      badgeKey: "seller.application_status",
      priority: NotificationPriority.HIGH,
      entityType: "seller_application",
      entityId: event.data.applicationId,
      metadata: {
        correctionTargets: event.data.correctionTargets ?? [],
        submissionRevision: event.data.submissionRevision,
      },
      occurredAt: new Date(event.occurredAt),
      expiresAt: this.createExpiryDate(event.occurredAt),
    };
  }

  // Tính TTL từ thời điểm event để retry trễ không vô tình kéo dài thời gian lưu notification.
  private createExpiryDate(occurredAt: string): Date {
    const expiresAt = new Date(occurredAt);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + NOTIFICATION_RETENTION_DAYS);
    return expiresAt;
  }
}
