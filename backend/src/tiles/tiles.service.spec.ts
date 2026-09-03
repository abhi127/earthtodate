import { TilesService } from './tiles.service';

describe('TilesService session cookie', () => {
  const origFetch = globalThis.fetch;
  const origEnv = { ...process.env };

  afterEach(() => {
    globalThis.fetch = origFetch;
    process.env = { ...origEnv };
  });

  it('logs in, uses the session cookie, and caches it across calls', async () => {
    process.env.TILE_SERVER_EMAIL = 'test@example.com';
    process.env.TILE_SERVER_API_KEY = 'secret-key';
    let loginCalls = 0;

    const fetchMock = jest.fn(async (url: string, init?: any) => {
      if (url.endsWith('/login')) {
        loginCalls++;
        return new Response('{"success":true}', {
          status: 200,
          headers: { 'set-cookie': 'session=abc123; path=/; Max-Age=2592000' },
        });
      }
      return new Response(Buffer.from([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const svc = new TilesService();
    await svc.proxy('/v2/x/1/2/3', '');
    await svc.proxy('/v2/x/1/2/3', '');

    expect(loginCalls).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/v2\/x\/1\/2\/3$/),
      expect.objectContaining({ headers: expect.objectContaining({ cookie: 'session=abc123' }) }),
    );
  });

  it('re-logins and retries once when the session is rejected', async () => {
    process.env.TILE_SERVER_EMAIL = 'test@example.com';
    process.env.TILE_SERVER_API_KEY = 'secret-key';

    const fetchMock = jest.fn(async (url: string, init?: any) => {
      if (url.endsWith('/login')) {
        return new Response('{"success":true}', {
          status: 200,
          headers: { 'set-cookie': 'session=refresh456; path=/' },
        });
      }
      const cookie = init?.headers?.cookie as string;
      if (cookie === 'session=old') return new Response('reject', { status: 401 });
      return new Response(Buffer.from([9, 9]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      });
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const svc = new TilesService();
    // Force a known (rejected) seed cookie.
    svc['sessionCookie'] = 'session=old';

    const result = await svc.proxy('/v2/x/1/2/3', '');
    expect(result.body.length).toBe(2);
    // login once + tile once, then retry tile once = 3 upstream calls, 1 login
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/v2\/x\/1\/2\/3$/),
      expect.objectContaining({ headers: expect.objectContaining({ cookie: 'session=refresh456' }) }),
    );
  });
});
