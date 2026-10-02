import * as os from 'os';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fsp = require('fs').promises;
import { GisService } from './gis.service';

// Minimal single-polygon square (0,0)-(1,0)-(1,1)-(0,1)-(0,0) fixtures,
// crafted at runtime so no binary files live in the repo.
function buildShp(): Buffer {
  const header = Buffer.alloc(100);
  header.writeInt32BE(9994, 0);
  header.writeInt32LE(1000, 28);
  header.writeInt32LE(5, 32); // polygon
  const box = [0, 0, 1, 1];
  box.forEach((v, i) => header.writeDoubleLE(v, 36 + i * 8));

  const points = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
  const content = Buffer.alloc(4 + 32 + 4 + 4 + 4 + points.length * 16);
  let o = 0;
  content.writeInt32LE(5, o); o += 4;
  box.forEach((v) => { content.writeDoubleLE(v, o); o += 8; });
  content.writeInt32LE(1, o); o += 4;
  content.writeInt32LE(points.length, o); o += 4;
  content.writeInt32LE(0, o); o += 4;
  for (const [x, y] of points) { content.writeDoubleLE(x, o); content.writeDoubleLE(y, o + 8); o += 16; }

  const record = Buffer.alloc(8 + content.length);
  record.writeInt32BE(1, 0);
  record.writeInt32BE(content.length / 2, 4);
  content.copy(record, 8);

  const fileLengthWords = 50 + record.length / 2;
  header.writeInt32BE(fileLengthWords, 24);
  return Buffer.concat([header, record]);
}

function buildShx(contentWords: number): Buffer {
  const header = Buffer.alloc(100);
  header.writeInt32BE(9994, 0);
  header.writeInt32BE(54, 24); // 50 + 1 index entry
  header.writeInt32LE(1000, 28);
  header.writeInt32LE(5, 32);
  const entry = Buffer.alloc(8);
  entry.writeInt32BE(50, 0); // offset in words
  entry.writeInt32BE(contentWords, 4);
  return Buffer.concat([header, entry]);
}

function buildDbf(): Buffer {
  const header = Buffer.alloc(32);
  header[0] = 0x03;
  header.writeInt32LE(1, 4); // 1 record
  header.writeInt16LE(65, 8); // header length
  header.writeInt16LE(11, 10); // record length
  const field = Buffer.alloc(32);
  Buffer.from('NAME').copy(field, 0);
  field[11] = 'C'.charCodeAt(0);
  field[16] = 10; // width
  const record = Buffer.from(' SQ        ');
  return Buffer.concat([header, field, Buffer.from([0x0d]), record]);
}

describe('GisService.parseShapefile (side-effect free)', () => {
  const svc = new GisService(null as any);
  const dir = os.tmpdir();
  const tag = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  async function writeFixtures(withPrj: boolean) {
    const base = path.join(dir, `aoi-${tag()}`);
    const files: Express.Multer.File[] = [];
    const shpPath = `${base}.shp`;
    await fsp.writeFile(shpPath, buildShp());
    files.push({ path: shpPath, originalname: 'aoi.shp' } as Express.Multer.File);
    const shxPath = `${base}.shx`;
    await fsp.writeFile(shxPath, buildShx(64));
    files.push({ path: shxPath, originalname: 'aoi.shx' } as Express.Multer.File);
    const dbfPath = `${base}.dbf`;
    await fsp.writeFile(dbfPath, buildDbf());
    files.push({ path: dbfPath, originalname: 'aoi.dbf' } as Express.Multer.File);
    if (withPrj) {
      const prjPath = `${base}.prj`;
      await fsp.writeFile(prjPath, 'GEOGCS["GCS_WGS_1984"]');
      files.push({ path: prjPath, originalname: 'aoi.prj' } as Express.Multer.File);
    }
    return files;
  }

  it('parses shapefile parts to GeoJSON without persisting anything', async () => {
    const files = await writeFixtures(true);
    const geojson = await svc.parseShapefile(files);

    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0].geometry.type).toBe('Polygon');
    // temp files are cleaned up
    for (const f of files) {
      await expect(fsp.access(f.path)).rejects.toThrow();
    }
  });

  it('works without a .prj sidecar (assumes WGS84)', async () => {
    const files = await writeFixtures(false);
    const geojson = await svc.parseShapefile(files);
    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0].geometry.type).toBe('Polygon');
  });

  it('rejects uploads missing the .dbf component', async () => {
    const base = path.join(dir, `aoi-${tag()}`);
    const shpPath = `${base}.shp`;
    await fsp.writeFile(shpPath, buildShp());
    const files = [{ path: shpPath, originalname: 'aoi.shp' } as Express.Multer.File];
    await expect(svc.parseShapefile(files)).rejects.toThrow('Missing required Shapefile components');
    await expect(fsp.access(shpPath)).rejects.toThrow();
  });
});
