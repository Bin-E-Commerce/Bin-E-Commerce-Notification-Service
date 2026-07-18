import {
  NotificationAudience,
  NotificationCategory,
  NotificationPriority,
} from "@common/notifications";

export interface CreateNotificationInput {
  eventId: string;
  eventName: string;
  eventVersion: number;
  source: string;
  category: NotificationCategory;
  type: string;
  audiences: NotificationAudience[];
  title: string;
  message: string;
  actionUrl?: string | null;
  badgeKey?: string | null;
  priority: NotificationPriority;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
  expiresAt: Date;
}
