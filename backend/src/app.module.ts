import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GisModule } from './gis/gis.module';
import { TilesModule } from './tiles/tiles.module';

const frontendDist = process.env.FRONTEND_DIST || 'public';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute globally
      },
    ]),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), frontendDist),
      exclude: ['/api/(.*)'],
    }),
    ConfigModule,
    AuthModule,
    UsersModule,
    GisModule,
    TilesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
