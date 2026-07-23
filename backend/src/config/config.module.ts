import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './database.config';

@Global()
@Module({
  imports: [TypeOrmModule.forRootAsync(databaseConfig)],
  exports: [TypeOrmModule],
})
export class ConfigModule {}
