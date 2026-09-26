import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsController } from '@/modules/notifications/presentation/controllers/notifications.controller';
import { SellerApplicationNotificationPolicy } from '@/modules/notifications/application/policies/seller/seller-application-notification.policy';
import { ShopProfileChangeRequestNotificationPolicy } from '@/modules/notifications/application/policies/shop/shop-profile-change-request-notification.policy';
import { OrderNotificationPolicy } from '@/modules/notifications/application/policies/order/order-notification.policy';
import { ShipmentNotificationPolicy } from '@/modules/notifications/application/policies/shipment/shipment-notification.policy';
import { ReviewNotificationPolicy } from '@/modules/notifications/application/policies/review/review-notification.policy';
import { ReturnNotificationPolicy } from '@/modules/notifications/application/policies/return/return-notification.policy';
import {
    Notification,
    NotificationSchema,
} from '@/modules/notifications/infrastructure/schemas/notification.schema';
import {
    NotificationReceipt,
    NotificationReceiptSchema,
} from '@/modules/notifications/infrastructure/schemas/notification-receipt.schema';
import { NotificationAudienceService } from '@/modules/notifications/application/services/notification-audience.service';
import { NotificationRealtimePublisherService } from '@/modules/notifications/application/services/notification-realtime-publisher.service';
import { NotificationViewerService } from '@/modules/notifications/application/services/notification-viewer.service';
import { NotificationsService } from '@/modules/notifications/application/services/notifications.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Notification.name, schema: NotificationSchema },
            {
                name: NotificationReceipt.name,
                schema: NotificationReceiptSchema,
            },
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
