import { describe, it, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

let app: any;

describe('Binder version negotiation and capabilities', () => {
  beforeAll(async () => {
    // Simulate environment variable for supported versions
    process.env.BINDER_SUPPORTED_VERSIONS = 'v1.0.0,v1.1.0,v2.0.0';
    // Dynamic import to pick up the env var
    const mod = await import('../src/server/app.js');
    app = mod.app;
  });

  test('GET /api/_binder/capabilities returns supported versions', async () => {
    const res = await request(app).get('/api/_binder/capabilities');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('supported');
    expect(res.body.supported).toContain('v1.0.0');
    expect(res.body.supported).toContain('v2.0.0');
    expect(res.body).toHaveProperty('current');
  });

  test('Version negotiation sets X-API-Version header', async () => {
    const res = await request(app)
      .get('/api/_binder/health')
      .set('X-API-Version', 'v1.1.0');
    expect(res.headers['x-api-version']).toBe('v1.1.0');
  });

  test('Fallback to default version when unsupported version is requested', async () => {
    const res = await request(app)
      .get('/api/_binder/health')
      .set('X-API-Version', 'unknown');
    // default version is the first in supported list i.e., v1.0.0
    expect(res.headers['x-api-version']).toBe('v1.0.0');
  });

  test('GET /_binder/dashboard returns 404 when not generated', async () => {
    const res = await request(app).get('/_binder/dashboard');
    expect(res.status).toBe(404);
  });
});
