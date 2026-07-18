import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export const NOTIFICATION_REDIS = "NOTIFICATION_REDIS";

@Global()
@Module({
  providers: [
    {
      provide: NOTIFICATION_REDIS,
      inject: [ConfigService],
      // Tạo một Redis connection dùng cho publish realtime; Pub/Sub không được dùng làm nơi lưu thông báo.
      useFactory: (config: ConfigService): Redis =>
        new Redis({
          host: config.get<string>("REDIS_HOST", "localhost"),
          port: config.get<number>("REDIS_PORT", 6379),
          password: config.get<string>("REDIS_PASSWORD") || undefined,
          db: config.get<number>("REDIS_DB", 0),
          lazyConnect: true,
          maxRetriesPerRequest: 3,
        }),
    },
  ],
  exports: [NOTIFICATION_REDIS],
})
export class RedisModule {}
