import {
  Controller, Get, Post, Delete, Body, Param, UseGuards,
  UseInterceptors, UploadedFiles, BadRequestException, ParseUUIDPipe,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as crypto from 'crypto';
import { GisService } from './gis.service';
import { CreateLayerDto } from './dto/upload.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

const multerOptions = {
  storage: diskStorage({
    destination: process.env.UPLOAD_DIR || './uploads/gis',
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  }),
  fileFilter: (_req: any, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    const ext = extname(file.originalname).toLowerCase();
    const allowedExts = ['.geojson', '.json', '.shp', '.shx', '.dbf', '.prj'];
    if (!allowedExts.includes(ext)) {
      cb(new BadRequestException(`Unsupported file type: ${ext}`), false);
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10)) * 1024 * 1024,
    files: 4,
  },
};

@Controller('gis')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GisController {
  constructor(private readonly gisService: GisService) {}

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @UseInterceptors(FilesInterceptor('files', 4, multerOptions))
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateLayerDto,
    @CurrentUser('id') userId: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // Check if it's a GeoJSON upload (single file) or Shapefile (multiple files)
    const firstExt = extname(files[0].originalname).toLowerCase();
    if (firstExt === '.geojson' || firstExt === '.json') {
      if (files.length > 1) {
        // Filter to just GeoJSON files
        const geoJsonFiles = files.filter((f) => {
          const e = extname(f.originalname).toLowerCase();
          return e === '.geojson' || e === '.json';
        });
        if (geoJsonFiles.length === 1) {
          return this.gisService.uploadGeoJson(geoJsonFiles[0], dto, userId);
        }
        throw new BadRequestException('Only one GeoJSON file allowed per upload');
      }
      return this.gisService.uploadGeoJson(files[0], dto, userId);
    }

    // Shapefile upload (multiple files: .shp, .shx, .dbf, .prj)
    return this.gisService.uploadShapefile(files, dto, userId);
  }

  @Get('layers')
  findAll(@CurrentUser() user: { id: string; role: string }) {
    return this.gisService.findAll(user.id, user.role);
  }

  @Get('layers/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.gisService.findOne(id, user.id, user.role);
  }

  @Delete('layers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.gisService.remove(id, user.id, user.role);
  }
}
