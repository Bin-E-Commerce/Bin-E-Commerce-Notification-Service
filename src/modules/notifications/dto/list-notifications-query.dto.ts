import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { NotificationCategory } from "@common/notifications";

export enum NotificationReadStatus {
  ALL = "all",
  UNREAD = "unread",
  READ = "read",
}

export class ListNotificationsQueryDto {
  @IsOptional()
  @IsEnum(NotificationReadStatus)
  status: NotificationReadStatus = NotificationReadStatus.ALL;

  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
