import { Injectable } from "@nestjs/common";
import { FilterQuery } from "mongoose";
import { NotificationAudienceType } from "@common/notifications";
import { Notification } from "../../infrastructure/schemas/notification.schema";
import { NotificationViewer } from "../types/notification-viewer.type";

@Injectable()
export class NotificationAudienceService {
  // Tạo Mongo filter từ identity đã được Gateway xác thực; client không thể tự thêm role hoặc permission vào query.
  buildFilter(viewer: NotificationViewer): FilterQuery<Notification> {
    const matches: FilterQuery<Notification>[] = [
      {
        audiences: {
          $elemMatch: {
            type: NotificationAudienceType.USER,
            value: viewer.userId,
          },
        },
      },
      {
        audiences: {
          $elemMatch: {
            type: NotificationAudienceType.BROADCAST,
          },
        },
      },
    ];

    if (viewer.roles.length > 0) {
      matches.push({
        audiences: {
          $elemMatch: {
            type: NotificationAudienceType.ROLE,
            value: { $in: viewer.roles },
          },
        },
      });
    }

    if (viewer.permissions.length > 0) {
      matches.push({
        audiences: {
          $elemMatch: {
            type: NotificationAudienceType.PERMISSION,
            value: { $in: viewer.permissions },
            // Scope-specific audience chỉ được mở khi Gateway forward permission grants đầy đủ ở phiên bản sau.
            scope: { $exists: false },
          },
        },
      });
    }

    return { $or: matches };
  }
}
