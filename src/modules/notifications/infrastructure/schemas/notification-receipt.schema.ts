import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type NotificationReceiptDocument =
  HydratedDocument<NotificationReceipt>;

@Schema({ collection: "notification_receipts", timestamps: true })
export class NotificationReceipt {
  @Prop({ required: true, type: Types.ObjectId, index: true })
  notificationId: Types.ObjectId;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ type: Date, default: null })
  seenAt: Date | null;

  @Prop({ type: Date, default: null })
  readAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const NotificationReceiptSchema =
  SchemaFactory.createForClass(NotificationReceipt);

// Một user chỉ có một trạng thái đọc cho mỗi notification, giúp thao tác mark-read luôn idempotent.
NotificationReceiptSchema.index(
  { notificationId: 1, userId: 1 },
  { unique: true },
);
