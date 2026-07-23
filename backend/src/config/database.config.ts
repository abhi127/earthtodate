import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { join } from 'path';

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  useFactory: () => {
    const dbType = process.env.DATABASE_TYPE || 'sqlite';

    if (dbType === 'sqlite') {
      return {
        type: 'sqlite',
        database: process.env.SQLITE_PATH || './database.sqlite',
        entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
        synchronize: process.env.NODE_ENV !== 'production',
        autoLoadEntities: true,
      };
    }

    return {
      type: dbType as 'postgres' | 'mysql',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'geosyze',
      entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
      synchronize: process.env.NODE_ENV !== 'production',
      autoLoadEntities: true,
    };
  },
};
