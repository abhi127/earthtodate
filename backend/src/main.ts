import 'dotenv/config';
import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
          workerSrc: ["'self'", 'blob:'],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://cdn.jsdelivr.net',
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', '*'],
          connectSrc: [
            "'self'",
            'https://cdn.jsdelivr.net',
            'https://api.open-meteo.com',
            'https://nominatim.openstreetmap.org',
            'https://app.earthtodate.com',
          ],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  const loggerMw = new RequestLoggerMiddleware();
  app.use((req, res, next) => loggerMw.use(req, res, next));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`GeoSyze backend worker ${process.pid} running on http://localhost:${port}`);
}

// Multi-process mode: CLUSTER_WORKERS=N forks N workers sharing the port
// (each with its own tile cache and upstream session). Opt-in — notably the
// default sqlite store serializes writes, so pair workers>1 with postgres
// for write-heavy auth traffic.
function clusterSize(): number {
  const raw = parseInt(process.env.CLUSTER_WORKERS || '0', 10);
  if (!Number.isFinite(raw) || raw <= 1) return 0;
  return Math.min(raw, availableParallelism());
}

if (cluster.isPrimary && clusterSize() > 0) {
  const count = clusterSize();
  console.log(`GeoSyze primary ${process.pid}: forking ${count} workers`);
  for (let i = 0; i < count; i++) cluster.fork();
  cluster.on('exit', (worker, code, signal) => {
    console.log(`GeoSyze worker ${worker.process.pid} exited (${signal || code}); reforking in 1s`);
    setTimeout(() => cluster.fork(), 1000);
  });
} else {
  bootstrap();
}
