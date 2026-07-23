import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GisController } from './gis.controller';
import { GisService } from './gis.service';
import { GisLayer } from './entities/gis-layer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GisLayer])],
  controllers: [GisController],
  providers: [GisService],
})
export class GisModule {}
