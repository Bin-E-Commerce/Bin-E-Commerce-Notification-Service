// File này lắp dependency graph của Notification Service, gồm Kafka consumers, Mongo persistence, realtime và email.
// AppModule không chứa logic nghiệp vụ; các policy/service chuyên trách giữ boundary của từng loại thông báo.

import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ThrottlerModule } from "@nestjs/throttler";
import { TerminusModule } from "@nestjs/terminus";
import { EmailModule } from "./modules/email/email.module";
import { HealthModule } from "./modules/health/health.module";
import { OtpConsumer } from "./kafka/consumers/otp.consumer";
import { SellerApplicationConsumer } from "./kafka/consumers/seller-application.consumer";
import { ShopProfileChangeRequestConsumer } from "./kafka/consumers/shop-profile-change-request.consumer";
import { OrderConsumer } from "./kafka/consumers/order.consumer";
import { ShipmentConsumer } from "./kafka/consumers/shipment.consumer";
import { ReviewConsumer } from "./kafka/consumers/review.consumer";
import { ReturnConsumer } from "./kafka/consumers/return.consumer";
import { RedisModule } from "./infrastructure/redis/redis.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AuthUserEmailClient } from "./integrations/auth-user-email.client";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>(
          "MONGODB_URI",
          "mongodb://localhost:27017/bin_notification",
        ),
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    TerminusModule,
    RedisModule,
    EmailModule,
    NotificationsModule,
    HealthModule,
  ],
  controllers: [
    OtpConsumer,
    SellerApplicationConsumer,
    ShopProfileChangeRequestConsumer,
    OrderConsumer,
    ShipmentConsumer,
    ReviewConsumer,
    ReturnConsumer,
  ],
  providers: [AuthUserEmailClient],
})
export class AppModule {}
