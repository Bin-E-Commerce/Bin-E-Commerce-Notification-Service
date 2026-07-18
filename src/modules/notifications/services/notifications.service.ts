import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, PipelineStage, Types } from "mongoose";
import { NotificationCategory } from "@common/notifications";
import {
  ListNotificationsQueryDto,
  NotificationReadStatus,
} from "../dto/list-notifications-query.dto";
import { Notification } from "../schemas/notification.schema";
import { NotificationReceipt } from "../schemas/notification-receipt.schema";
import { CreateNotificationInput } from "../types/create-notification-input.type";
import {
  NotificationItemResponse,
  NotificationListResponse,
  NotificationUnreadCountsResponse,
} from "../types/notification-response.type";
import { NotificationViewer } from "../types/notification-viewer.type";
import { NotificationAudienceService } from "./notification-audience.service";
import { NotificationRealtimePublisherService } from "./notification-realtime-publisher.service";

interface NotificationAggregateRow extends Notification {
  _id: Types.ObjectId;
  viewerReceipt?: {
    readAt?: Date | null;
  } | null;
}

interface NotificationCursor {
  createdAt: string;
  id: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
    @InjectModel(NotificationReceipt.name)
    private readonly receiptModel: Model<NotificationReceipt>,
    private readonly audienceService: NotificationAudienceService,
    private readonly realtime: NotificationRealtimePublisherService,
  ) {}

  // Lưu idempotent theo eventId rồi mới publish realtime để Kafka retry không tạo bản ghi hoặc badge trùng.
  async createFromEvent(
    input: CreateNotificationInput,
  ): Promise<{ created: boolean; id: string }> {
    try {
      const notification = await this.notificationModel.create(input);
      await this.realtime.publishCreated(notification);
      return { created: true, id: notification.id };
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        const existing = await this.notificationModel
          .findOne({ eventId: input.eventId })
          .select({ _id: 1 })
          .lean();
        return { created: false, id: existing?._id.toString() ?? "" };
      }

      throw error;
    }
  }

  // Trả feed theo cursor và ghép receipt của viewer ngay trong Mongo để lọc read/unread chính xác trước khi phân trang.
  async list(
    viewer: NotificationViewer,
    query: ListNotificationsQueryDto,
  ): Promise<NotificationListResponse> {
    const match = this.buildListFilter(viewer, query);
    const rows = await this.notificationModel.aggregate<NotificationAggregateRow>([
      { $match: match },
      { $sort: { createdAt: -1, _id: -1 } },
      ...this.buildReceiptLookup(viewer.userId),
      ...this.buildReadStatusFilter(query.status),
      { $limit: query.limit + 1 },
    ]);

    const hasNext = rows.length > query.limit;
    const pageRows = rows.slice(0, query.limit);
    const lastRow = pageRows.at(-1);

    return {
      items: pageRows.map((row) => this.toResponse(row)),
      nextCursor:
        hasNext && lastRow
          ? this.encodeCursor({
              createdAt: lastRow.createdAt.toISOString(),
              id: lastRow._id.toString(),
            })
          : null,
    };
  }

  // Đếm unread theo category và badgeKey để chuông cùng nhiều sidebar dùng một response duy nhất.
  async getUnreadCounts(
    viewer: NotificationViewer,
  ): Promise<NotificationUnreadCountsResponse> {
    const [result] = await this.notificationModel.aggregate<{
      total: Array<{ count: number }>;
      categories: Array<{ _id: string; count: number }>;
      badgeKeys: Array<{ _id: string; count: number }>;
    }>([
      { $match: this.audienceService.buildFilter(viewer) },
      ...this.buildReceiptLookup(viewer.userId),
      { $match: { "viewerReceipt.readAt": null } },
      {
        $facet: {
          total: [{ $count: "count" }],
          categories: [{ $group: { _id: "$category", count: { $sum: 1 } } }],
          badgeKeys: [
            { $match: { badgeKey: { $ne: null } } },
            { $group: { _id: "$badgeKey", count: { $sum: 1 } } },
          ],
        },
      },
    ]);

    return {
      total: result?.total[0]?.count ?? 0,
      byCategory: Object.fromEntries(
        (result?.categories ?? []).map((item) => [item._id, item.count]),
      ),
      byBadgeKey: Object.fromEntries(
        (result?.badgeKeys ?? []).map((item) => [item._id, item.count]),
      ),
    };
  }

  // Đánh dấu một notification đã đọc sau khi xác minh viewer thật sự thuộc audience của bản ghi đó.
  async markRead(viewer: NotificationViewer, notificationId: string): Promise<void> {
    const objectId = this.toObjectId(notificationId);
    const accessible = await this.notificationModel.exists({
      _id: objectId,
      ...this.audienceService.buildFilter(viewer),
    });
    if (!accessible) throw new NotFoundException("Không tìm thấy thông báo.");

    const now = new Date();
    await this.receiptModel.updateOne(
      { notificationId: objectId, userId: viewer.userId },
      {
        $set: { readAt: now, seenAt: now },
        $setOnInsert: { notificationId: objectId, userId: viewer.userId },
      },
      { upsert: true },
    );
  }

  // Mark-all tạo receipt theo bulkWrite để giảm round-trip; category cho phép chỉ dọn một nhóm thông báo nếu cần.
  async markAllRead(
    viewer: NotificationViewer,
    category?: NotificationCategory,
  ): Promise<number> {
    const filter: FilterQuery<Notification> = {
      ...this.audienceService.buildFilter(viewer),
      ...(category ? { category } : {}),
    };
    const notifications = await this.notificationModel
      .find(filter)
      .select({ _id: 1 })
      .lean();
    if (notifications.length === 0) return 0;

    const now = new Date();
    await this.receiptModel.bulkWrite(
      notifications.map((notification) => ({
        updateOne: {
          filter: {
            notificationId: notification._id,
            userId: viewer.userId,
          },
          update: {
            $set: { readAt: now, seenAt: now },
            $setOnInsert: {
              notificationId: notification._id,
              userId: viewer.userId,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    return notifications.length;
  }

  // Kết hợp audience, category và cursor bằng $and để hai nhánh $or không ghi đè nhau.
  private buildListFilter(
    viewer: NotificationViewer,
    query: ListNotificationsQueryDto,
  ): FilterQuery<Notification> {
    const audienceFilter = this.audienceService.buildFilter(viewer);
    const filters: FilterQuery<Notification>[] = [audienceFilter];
    if (query.category) filters.push({ category: query.category });

    if (query.cursor) {
      const cursor = this.decodeCursor(query.cursor);
      const createdAt = new Date(cursor.createdAt);
      const id = this.toObjectId(cursor.id);
      filters.push({
        $or: [
          { createdAt: { $lt: createdAt } },
          { createdAt, _id: { $lt: id } },
        ],
      });
    }

    // Trả trực tiếp audience filter khi không có điều kiện phụ để Mongo không phải xử lý một $and chỉ có một phần tử.
    return filters.length === 1 ? audienceFilter : { $and: filters };
  }

  // Lookup chỉ lấy receipt của viewer hiện tại để không lộ trạng thái đọc của user khác.
  private buildReceiptLookup(userId: string): PipelineStage[] {
    return [
      {
        $lookup: {
          from: "notification_receipts",
          let: { notificationId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$notificationId", "$$notificationId"] },
                    { $eq: ["$userId", userId] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: "viewerReceipts",
        },
      },
      {
        $addFields: {
          viewerReceipt: { $arrayElemAt: ["$viewerReceipts", 0] },
        },
      },
      { $unset: "viewerReceipts" },
    ];
  }

  // Status all không thêm pipeline; read và unread dựa trên readAt của receipt đã lookup.
  private buildReadStatusFilter(status: NotificationReadStatus): PipelineStage[] {
    if (status === NotificationReadStatus.READ) {
      return [{ $match: { "viewerReceipt.readAt": { $ne: null } } }];
    }
    if (status === NotificationReadStatus.UNREAD) {
      return [{ $match: { "viewerReceipt.readAt": null } }];
    }
    return [];
  }

  // Chỉ trả các field phục vụ UI notification center, không trả audience hoặc metadata nội bộ.
  private toResponse(row: NotificationAggregateRow): NotificationItemResponse {
    return {
      id: row._id.toString(),
      category: row.category,
      type: row.type,
      title: row.title,
      message: row.message,
      actionUrl: row.actionUrl,
      badgeKey: row.badgeKey,
      priority: row.priority,
      createdAt: row.createdAt.toISOString(),
      readAt: row.viewerReceipt?.readAt?.toISOString() ?? null,
    };
  }

  // Cursor được encode base64url để API không lộ cấu trúc phân trang và vẫn an toàn trong query string.
  private encodeCursor(cursor: NotificationCursor): string {
    return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
  }

  // Từ chối cursor sai cấu trúc thay vì âm thầm trả trang đầu gây dữ liệu lặp trên client.
  private decodeCursor(value: string): NotificationCursor {
    try {
      const cursor = JSON.parse(
        Buffer.from(value, "base64url").toString("utf8"),
      ) as NotificationCursor;
      if (!cursor.createdAt || !cursor.id || Number.isNaN(Date.parse(cursor.createdAt))) {
        throw new Error("Invalid cursor");
      }
      return cursor;
    } catch {
      throw new BadRequestException("Cursor thông báo không hợp lệ.");
    }
  }

  // Chuẩn hóa ID Mongo và trả lỗi nghiệp vụ dễ hiểu thay vì để CastError thành lỗi 500.
  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException("Mã thông báo không hợp lệ.");
    }
    return new Types.ObjectId(value);
  }

  // Mongo error code 11000 là tín hiệu eventId đã được xử lý, không phải lỗi nghiệp vụ cần retry.
  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    );
  }
}
