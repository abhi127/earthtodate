import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import { GisLayer } from './entities/gis-layer.entity';
import { CreateLayerDto } from './dto/upload.dto';

// ponytail: avoid ts-node module resolution issues with fs/promises
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fsp = require('fs').promises;

@Injectable()
export class GisService {
  private readonly logger = new Logger(GisService.name);

  constructor(
    @InjectRepository(GisLayer)
    private readonly repo: Repository<GisLayer>,
  ) {}

  async uploadGeoJson(
    file: Express.Multer.File,
    dto: CreateLayerDto,
    userId: string,
  ): Promise<GisLayer> {
    const content = await fsp.readFile(file.path, 'utf-8');
    let geojson: Record<string, any>;

    try {
      geojson = JSON.parse(content);
    } catch {
      await fsp.unlink(file.path).catch(() => {});
      throw new BadRequestException('Invalid JSON file');
    }

    // Basic GeoJSON RFC 7946 validation
    if (!geojson.type || geojson.type !== 'FeatureCollection' && geojson.type !== 'Feature' && geojson.type !== 'GeometryCollection') {
      await fsp.unlink(file.path).catch(() => {});
      throw new BadRequestException('File is not valid GeoJSON - missing valid type');
    }

    // Normalize to FeatureCollection
    if (geojson.type === 'Feature') {
      geojson = {
        type: 'FeatureCollection',
        features: [geojson],
      };
    } else if (geojson.type === 'GeometryCollection' || geojson.type === 'Point' || geojson.type === 'LineString' || geojson.type === 'Polygon' || geojson.type === 'MultiPoint' || geojson.type === 'MultiLineString' || geojson.type === 'MultiPolygon') {
      geojson = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: geojson, properties: {} }],
      };
    }

    this.sanitizeGeoJson(geojson);

    const layer = this.repo.create({
      name: dto.name,
      description: dto.description || undefined,
      geojson,
      isPublic: dto.isPublic ?? false,
      originalFilename: file.originalname,
      fileType: 'geojson',
      ownerId: userId,
    });

    return this.repo.save(layer);
  }

  async uploadShapefile(
    files: Express.Multer.File[],
    dto: CreateLayerDto,
    userId: string,
  ): Promise<GisLayer> {
    const extensions = files.map((f) => path.extname(f.originalname).toLowerCase());
    const required = ['.shp', '.shx', '.dbf', '.prj'];
    const missing = required.filter((ext) => !extensions.includes(ext));

    if (missing.length > 0) {
      await Promise.all(files.map((f) => fsp.unlink(f.path).catch(() => {})));
      throw new BadRequestException(
        `Missing required Shapefile components: ${missing.join(', ')}`,
      );
    }

    try {
      // ponytail: using dynamic import for shapefile parser
      // postgres+postgis upgrade: store raw shapefile + convert to geometry column
      const { default: openShapefile } = await import('shapefile');
      const shpFile = files.find((f) => path.extname(f.originalname).toLowerCase() === '.shp')!;

      const source = await openShapefile(shpFile.path);
      const features: Record<string, any>[] = [];
      let result = await source.read();
      while (!result.done) {
        features.push(result.value);
        result = await source.read();
      }

      const geojson: Record<string, any> = {
        type: 'FeatureCollection',
        features,
      };

      this.sanitizeGeoJson(geojson);

      const layer = this.repo.create({
        name: dto.name,
        description: dto.description || undefined,
        geojson,
        isPublic: dto.isPublic ?? false,
        originalFilename: files[0].originalname,
        fileType: 'shapefile',
        ownerId: userId,
      });

      return this.repo.save(layer);
    } catch (err) {
      await Promise.all(files.map((f) => fsp.unlink(f.path).catch(() => {})));
      throw new BadRequestException(`Failed to parse Shapefile: ${err.message}`);
    }
  }

  async findAll(userId: string, role: string): Promise<GisLayer[]> {
    if (role === 'admin') {
      return this.repo.find({ order: { createdAt: 'DESC' } });
    }
    return this.repo.find({
      where: [{ ownerId: userId }, { isPublic: true }],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string, role: string): Promise<GisLayer> {
    const layer = await this.repo.findOne({ where: { id } });
    if (!layer) throw new NotFoundException('Layer not found');

    const isOwner = layer.ownerId === userId;
    if (!layer.isPublic && !isOwner && role !== 'admin') {
      throw new NotFoundException('Layer not found');
    }

    return layer;
  }

  async remove(id: string, userId: string, role: string): Promise<void> {
    const layer = await this.repo.findOne({ where: { id } });
    if (!layer) throw new NotFoundException('Layer not found');

    const isOwner = layer.ownerId === userId;
    if (!isOwner && role !== 'admin') {
      throw new NotFoundException('Layer not found');
    }

    await this.repo.remove(layer);
  }

  // Strip properties > 10KB to prevent XSS/bloat via crafted GeoJSON
  private sanitizeGeoJson(geojson: Record<string, any>): void {
    const maxPropBytes = 10240;
    if (!geojson.features || !Array.isArray(geojson.features)) return;
    for (const feature of geojson.features) {
      if (feature.properties && typeof feature.properties === 'object') {
        for (const key of Object.keys(feature.properties)) {
          const val = feature.properties[key];
          if (typeof val === 'string' && Buffer.byteLength(val, 'utf-8') > maxPropBytes) {
            // ponytail: truncate rather than remove - keeps schema intact
            feature.properties[key] = val.substring(0, maxPropBytes);
          }
        }
      }
    }
  }
}
