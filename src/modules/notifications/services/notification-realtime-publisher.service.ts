import { Inject, Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";
import {
  NOTIFICATION_REALTIME_CHANNEL,
  NotificationRealtimeEvents,
  NotificationRealtimeMessage,
} from "@common/notifications";
import { NOTIFICATION_REDIS } from "../../../infrastructure/redis/redis.module";
import { NotificationDocument } from "../schemas/notification.schema";

@Injectable()
export class NotificationRealtimePublisherService {
  private readonly logger = new Logger(NotificationRealtimePublisherService.name);

  constructor(@Inject(NOTIFICATION_REDIS) private readonly redis: Redis) {}

  // Publish sau khi Mongo đã lưu thành công; Redis lỗi chỉ làm mất tín hiệu tức thời, REST vẫn khôi phục được feed.
  async publishCreated(notification: NotificationDocument): Promise<void> {
    const message: NotificationRealtimeMessage = {
      name: NotificationRealtimeEvents.CREATED,
      audiences: notification.audiences,
      notification: {
        id: notification.id,
        category: notification.category,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        actionUrl: notification.actionUrl,
        badgeKey: notification.badgeKey,
        priority: notification.priority,
        createdAt: notification.createdAt.toISOString(),
      },
    };

    try {
      await this.redis.publish(
        NOTIFICATION_REALTIME_CHANNEL,
        JSON.stringify(message),
      );
    } catch (error) {
      this.logger.warn(
        `Không thể publish realtime notification ${notification.id}: ${String(error)}`,
      );
    }
  }
}
