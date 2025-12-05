import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        isGlobal: true,
        store: redisStore,
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
        ttl: configService.get('REDIS_TTL', 3600),
        password: configService.get('REDIS_PASSWORD'),
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [CacheModule],
})
export class RedisModule {}
