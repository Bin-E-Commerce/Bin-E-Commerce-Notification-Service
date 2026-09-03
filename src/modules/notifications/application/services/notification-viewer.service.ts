import { Injectable, UnauthorizedException } from "@nestjs/common";
import { NotificationViewer } from "../types/notification-viewer.type";

@Injectable()
export class NotificationViewerService {
  // Chuyển trusted headers do API Gateway inject thành viewer context dùng thống nhất cho mọi truy vấn notification.
  fromHeaders(headers: Record<string, string | string[] | undefined>): NotificationViewer {
    const userId = this.readHeader(headers, "x-user-id");
    if (!userId) {
      throw new UnauthorizedException("Thiếu thông tin người dùng đã xác thực.");
    }

    return {
      userId,
      roles: this.readCsvHeader(headers, "x-user-roles"),
      permissions: this.readCsvHeader(headers, "x-user-permissions"),
    };
  }

  // Header có thể là string hoặc string[] tùy HTTP adapter nên luôn chuẩn hóa về một string duy nhất.
  private readHeader(
    headers: Record<string, string | string[] | undefined>,
    key: string,
  ): string | undefined {
    const value = headers[key];
    return Array.isArray(value) ? value[0] : value;
  }

  // Tách CSV do Gateway forward, đồng thời loại giá trị rỗng và trùng để query audience gọn hơn.
  private readCsvHeader(
    headers: Record<string, string | string[] | undefined>,
    key: string,
  ): string[] {
    const value = this.readHeader(headers, key);
    if (!value) return [];

    return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  }
}
