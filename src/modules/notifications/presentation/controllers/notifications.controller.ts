import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ListNotificationsQueryDto } from "../dto/list-notifications-query.dto";
import { MarkAllNotificationsReadDto } from "../dto/mark-all-notifications-read.dto";
import { NotificationViewerService } from "../../application/services/notification-viewer.service";
import { NotificationsService } from "../../application/services/notifications.service";

type TrustedHeaders = Record<string, string | string[] | undefined>;

@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly viewers: NotificationViewerService,
  ) {}

  // Trả notification feed của chính viewer dựa trên user, role và permission do API Gateway forward.
  @Get()
  async list(
    @Headers() headers: TrustedHeaders,
    @Query() query: ListNotificationsQueryDto,
  ) {
    const data = await this.notifications.list(
      this.viewers.fromHeaders(headers),
      query,
    );
    return { data, message: "Lấy danh sách thông báo thành công.", statusCode: 200 };
  }

  // Trả tổng unread và breakdown để chuông/sidebar cùng dùng một request.
  @Get("unread-counts")
  async getUnreadCounts(@Headers() headers: TrustedHeaders) {
    const data = await this.notifications.getUnreadCounts(
      this.viewers.fromHeaders(headers),
    );
    return { data, message: "Lấy số thông báo chưa đọc thành công.", statusCode: 200 };
  }

  // Mark-read idempotent: gọi nhiều lần vẫn giữ một receipt duy nhất cho user và notification.
  @Patch(":id/read")
  async markRead(
    @Headers() headers: TrustedHeaders,
    @Param("id") id: string,
  ) {
    await this.notifications.markRead(this.viewers.fromHeaders(headers), id);
    return { data: null, message: "Đã đánh dấu thông báo là đã đọc.", statusCode: 200 };
  }

  // Mark-all nhận bộ lọc category hoặc badgeKey để FE có thể dọn toàn bộ chuông hoặc riêng badge của menu vừa mở.
  @Post("read-all")
  @HttpCode(200)
  async markAllRead(
    @Headers() headers: TrustedHeaders,
    @Body() dto: MarkAllNotificationsReadDto,
  ) {
    const updated = await this.notifications.markAllRead(
      this.viewers.fromHeaders(headers),
      {
        category: dto.category,
        badgeKey: dto.badgeKey,
      },
    );
    return {
      data: { updated },
      message: "Đã đánh dấu tất cả thông báo là đã đọc.",
      statusCode: 200,
    };
  }
}
