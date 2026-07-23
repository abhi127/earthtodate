import { Injectable, Logger } from '@nestjs/common';

// Simple in-memory cache with TTL — no deps needed.
class TileCache {
  private store = new Map<string, { body: Buffer; contentType: string; expiry: number }>();
  private cacheHits = 0;
  private cacheMisses = 0;

  get(key: string): { body: Buffer; contentType: string } | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    this.cacheHits++;
    return { body: entry.body, contentType: entry.contentType };
  }

  set(key: string, body: Buffer, contentType: string, ttlMs: number) {
    // ponytail: simple Map-based cache, upgrade to Redis if throughput demands it
    if (this.store.size > 5000) {
      // Evict oldest 20% when over limit
      const keys = [...this.store.keys()].slice(0, 1000);
      keys.forEach(k => this.store.delete(k));
    }
    this.store.set(key, { body, contentType, expiry: Date.now() + ttlMs });
  }

  stats() {
    return { size: this.store.size, hits: this.cacheHits, misses: this.cacheMisses };
  }
}

@Injectable()
export class TilesService {
  private cache = new TileCache();
  private readonly logger = new Logger(TilesService.name);
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.TILE_SERVER_BASE_URL || 'http://localhost:8000';
  }

  async proxy(path: string, queryString: string, cacheTtlMs = 300_000, incomingHeaders?: Record<string, string>): Promise<{ body: Buffer; contentType: string }> {
    const fullUrl = `${this.baseUrl}${path}${queryString ? '?' + queryString : ''}`;
    const cacheKey = `${path}?${queryString}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.log(`CACHE HIT  ${path}`);
      return cached;
    }

    this.logger.log(`PROXY  ${fullUrl}`);

    // Forward browser-like headers so upstream server doesn't reject Node's fetch
    const headers: Record<string, string> = {
      'cookie':'session=eyJ1c2VyIjogeyJ1c2VyX2lkIjogImVpVnBubkR4ZmlzY2wiLCAidXNlcm5hbWUiOiBudWxsLCAiZW1haWwiOiBudWxsLCAiYWRtaW4iOiBudWxsLCAibWluZXJhbG1hcCI6IDAsICJlc3Jpd29ybGRpbWFnZXJ5IjogMH19.al5TRg.UKWGEQ3wQEhU-PQhi5To4kV56t4',
      'User-Agent': incomingHeaders?.['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      Accept: incomingHeaders?.accept || 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      ...(incomingHeaders?.referer ? { Referer: incomingHeaders.referer } : {}),
      ...(incomingHeaders?.['accept-encoding'] ? { 'Accept-Encoding': incomingHeaders['accept-encoding'] } : {}),
    };

    // Proxy to tile server
    const res = await fetch(fullUrl, { headers });
    if (!res.ok) {
      this.logger.warn(`UPSTREAM ${res.status} ${path}`);
      throw new Error(`Tile server error ${res.status} for ${fullUrl}`);
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const body = Buffer.from(await res.arrayBuffer());

    this.cache.set(cacheKey, body, contentType, cacheTtlMs);
    this.logger.log(`CACHED ${path} (${(body.length / 1024).toFixed(1)} KB)`);
    return { body, contentType };
  }

  getCacheStats() {
    return this.cache.stats();
  }
}
