import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes } from "mongoose";
import {
  NotificationAudience,
  NotificationAudienceType,
  NotificationCategory,
  NotificationPriority,
} from "@common/notifications";

@Schema({ _id: false })
class NotificationAudienceRecord implements NotificationAudience {
  @Prop({ required: true, enum: NotificationAudienceType })
  type: NotificationAudienceType;

  @Prop({ type: String })
  value?: string;

  @Prop({ type: String })
  scope?: string;
}

const NotificationAudienceSchema = SchemaFactory.createForClass(
  NotificationAudienceRecord,
);

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ collection: "notifications", timestamps: true })
export class Notification {
  @Prop({ required: true, unique: true, index: true })
  eventId: string;

  @Prop({ required: true, index: true })
  eventName: string;

  @Prop({ required: true, min: 1 })
  eventVersion: number;

  @Prop({ required: true })
  source: string;

  @Prop({ required: true, enum: NotificationCategory, index: true })
  category: NotificationCategory;

  @Prop({ required: true, index: true })
  type: string;

  @Prop({ type: [NotificationAudienceSchema], required: true })
  audiences: NotificationAudience[];

  @Prop({ required: true, maxlength: 180 })
  title: string;

  @Prop({ required: true, maxlength: 500 })
  message: string;

  @Prop({ type: String, default: null })
  actionUrl: string | null;

  @Prop({ type: String, default: null, index: true })
  badgeKey: string | null;

  @Prop({ required: true, enum: NotificationPriority })
  priority: NotificationPriority;

  @Prop({ required: true })
  entityType: string;

  @Prop({ required: true, index: true })
  entityId: string;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  metadata: Record<string, unknown>;

  @Prop({ required: true, index: true })
  occurredAt: Date;

  @Prop({ required: true })
  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// TTL chỉ dọn dữ liệu feed hết hạn; event nghiệp vụ gốc vẫn được service sở hữu domain lưu độc lập.
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
NotificationSchema.index({ "audiences.type": 1, "audiences.value": 1, createdAt: -1 });
