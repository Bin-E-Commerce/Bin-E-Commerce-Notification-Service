import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { NotificationsController } from "./controllers/notifications.controller";
import { SellerApplicationNotificationPolicy } from "./policies/seller-application-notification.policy";
import { ShopProfileChangeRequestNotificationPolicy } from "./policies/shop-profile-change-request-notification.policy";
import { OrderNotificationPolicy } from "./policies/order-notification.policy";
import { ShipmentNotificationPolicy } from "./policies/shipment-notification.policy";
import {
  Notification,
  NotificationSchema,
} from "./schemas/notification.schema";
import {
  NotificationReceipt,
  NotificationReceiptSchema,
} from "./schemas/notification-receipt.schema";
import { NotificationAudienceService } from "./services/notification-audience.service";
import { NotificationRealtimePublisherService } from "./services/notification-realtime-publisher.service";
import { NotificationViewerService } from "./services/notification-viewer.service";
import { NotificationsService } from "./services/notifications.service";

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
  ],
  exports: [
    NotificationsService,
    SellerApplicationNotificationPolicy,
    ShopProfileChangeRequestNotificationPolicy,
    OrderNotificationPolicy,
    ShipmentNotificationPolicy,
  ],
})
export class NotificationsModule {}
