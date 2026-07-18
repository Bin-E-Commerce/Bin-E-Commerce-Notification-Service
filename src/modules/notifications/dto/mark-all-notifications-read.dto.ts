import { IsEnum, IsOptional } from "class-validator";
import { NotificationCategory } from "@common/notifications";

export class MarkAllNotificationsReadDto {
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;
}
