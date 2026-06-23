import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ThrottlerModule } from "@nestjs/throttler";
import { TerminusModule } from "@nestjs/terminus";
import { EmailModule } from "./modules/email/email.module";
import { HealthModule } from "./modules/health/health.module";
import { OtpConsumer } from "./kafka/consumers/otp.consumer";
import { SellerApplicationConsumer } from "./kafka/consumers/seller-application.consumer";

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
    EmailModule,
    HealthModule,
  ],
  controllers: [OtpConsumer, SellerApplicationConsumer],
})
export class AppModule {}
