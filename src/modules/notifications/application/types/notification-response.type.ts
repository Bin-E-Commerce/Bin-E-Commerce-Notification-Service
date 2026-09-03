import {
  NotificationCategory,
  NotificationPriority,
} from "@common/notifications";

export interface NotificationItemResponse {
  id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  badgeKey: string | null;
  priority: NotificationPriority;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationListResponse {
  items: NotificationItemResponse[];
  nextCursor: string | null;
}

export interface NotificationUnreadCountsResponse {
  total: number;
  byCategory: Record<string, number>;
  byBadgeKey: Record<string, number>;
}
