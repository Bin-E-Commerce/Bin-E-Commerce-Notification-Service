import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { NotificationCategory } from "@common/notifications";

export class MarkAllNotificationsReadDto {
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  // Badge key cho phép chỉ đánh dấu nhóm gắn với đúng menu đang mở, không ảnh hưởng notification khác cùng category.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  badgeKey?: string;
}
