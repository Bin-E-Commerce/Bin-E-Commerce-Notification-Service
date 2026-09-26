import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const NOTIFICATION_REDIS = 'NOTIFICATION_REDIS';

@Global()
@Module({
    providers: [
        {
            provide: NOTIFICATION_REDIS,
            inject: [ConfigService],
            // Tạo một Redis connection dùng cho publish realtime; Pub/Sub không được dùng làm nơi lưu thông báo.
            useFactory: (config: ConfigService): Redis => {
                // Dùng URL managed Redis khi có; local vẫn giữ cơ chế host/port cũ.
                const redisUrl = config.get<string>('REDIS_URL')?.trim();
                const options = {
                    db: config.get<number>('REDIS_DB', 0),
                    lazyConnect: true,
                    maxRetriesPerRequest: 3,
                };
                return redisUrl
                    ? new Redis(redisUrl, options)
                    : new Redis({
                          host: config.get<string>('REDIS_HOST', 'localhost'),
                          port: config.get<number>('REDIS_PORT', 6379),
                          password:
                              config.get<string>('REDIS_PASSWORD') || undefined,
                          ...options,
                      });
            },
        },
    ],
    exports: [NOTIFICATION_REDIS],
})
export class RedisModule {}
