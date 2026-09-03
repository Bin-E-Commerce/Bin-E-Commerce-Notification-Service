import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { NotificationsController } from "./presentation/controllers/notifications.controller";
import { SellerApplicationNotificationPolicy } from "./application/policies/seller/seller-application-notification.policy";
import { ShopProfileChangeRequestNotificationPolicy } from "./application/policies/shop/shop-profile-change-request-notification.policy";
import { OrderNotificationPolicy } from "./application/policies/order/order-notification.policy";
import { ShipmentNotificationPolicy } from "./application/policies/shipment/shipment-notification.policy";
import { ReviewNotificationPolicy } from "./application/policies/review/review-notification.policy";
import { ReturnNotificationPolicy } from "./application/policies/return/return-notification.policy";
import {
  Notification,
  NotificationSchema,
} from "./infrastructure/schemas/notification.schema";
import {
  NotificationReceipt,
  NotificationReceiptSchema,
} from "./infrastructure/schemas/notification-receipt.schema";
import { NotificationAudienceService } from "./application/services/notification-audience.service";
import { NotificationRealtimePublisherService } from "./application/services/notification-realtime-publisher.service";
import { NotificationViewerService } from "./application/services/notification-viewer.service";
import { NotificationsService } from "./application/services/notifications.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: NotificationReceipt.name, schema: NotificationReceiptSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationAudienceService,
    NotificationViewerService,
    NotificationRealtimePublisherService,
    SellerApplicationNotificationPolicy,
    ShopProfileChangeRequestNotificationPolicy,
    OrderNotificationPolicy,
    ShipmentNotificationPolicy,
    ReviewNotificationPolicy,
    ReturnNotificationPolicy,
  ],
  exports: [
    NotificationsService,
    SellerApplicationNotificationPolicy,
    ShopProfileChangeRequestNotificationPolicy,
    OrderNotificationPolicy,
    ShipmentNotificationPolicy,
    ReviewNotificationPolicy,
    ReturnNotificationPolicy,
  ],
})
export class NotificationsModule {}
