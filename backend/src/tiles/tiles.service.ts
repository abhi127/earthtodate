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
  private sessionCookie: string | null = null;
  private loginPromise: Promise<string> | null = null;

  constructor() {
    this.baseUrl = process.env.TILE_SERVER_BASE_URL || 'http://localhost:8000';
  }

  private async getSessionCookie(): Promise<string> {
    if (this.sessionCookie) return this.sessionCookie;
    if (this.loginPromise) return this.loginPromise;

    this.loginPromise = this.login();
    try {
      this.sessionCookie = await this.loginPromise;
      return this.sessionCookie;
    } finally {
      this.loginPromise = null;
    }
  }

  private async login(): Promise<string> {
    const email = process.env.TILE_SERVER_EMAIL;
    const apiKey = process.env.TILE_SERVER_API_KEY;
    if (!email || !apiKey) {
      throw new Error('TILE_SERVER_EMAIL and TILE_SERVER_API_KEY must be set');
    }

    const res = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, api_key: apiKey }),
    });
    if (!res.ok) {
      throw new Error(`Login failed ${res.status} for ${this.baseUrl}/login`);
    }

    const setCookie = res.headers.get('set-cookie');
    const match = setCookie && setCookie.match(/session=[^;]+/);
    if (!match) {
      throw new Error('Login did not return a session cookie');
    }
    this.logger.log('Logged in, new session cookie acquired');
    return match[0];
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

    this.logger.log(`PROXY HEADERS ${JSON.stringify(incomingHeaders)}`);

    // Use the backend-managed session cookie (auto-renewed on expiry).
    const headers: Record<string, string> = {
      cookie: await this.getSessionCookie(),
      'User-Agent': incomingHeaders?.['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      Accept: incomingHeaders?.accept || 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      ...(incomingHeaders?.referer ? { Referer: incomingHeaders.referer } : {}),
      ...(incomingHeaders?.['accept-encoding'] ? { 'Accept-Encoding': incomingHeaders['accept-encoding'] } : {}),
    };
    this.logger.log(`PROXY SENT HEADERS ${JSON.stringify(headers)}`);

    // Proxy to tile server, retrying once after re-login if the session expired mid-flight.
    let res = await fetch(fullUrl, { headers });
    if ((res.status === 401 || res.status === 403) && this.sessionCookie) {
      this.logger.warn(`Session rejected (${res.status}), re-logging in and retrying`);
      this.sessionCookie = null;
      this.loginPromise = null;
      headers.cookie = await this.getSessionCookie();
      res = await fetch(fullUrl, { headers });
    }
    this.logger.log(`UPSTREAM RESPONSE ${res.status} ${res.statusText} for ${fullUrl}`);
    if (!res.ok) {
      const respBody = (await res.text()).slice(0, 2000);
      this.logger.warn(`UPSTREAM ${res.status} ${path} BODY=${respBody}`);
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
