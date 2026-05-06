import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { BinderClient } from '../src/client/binderClient.js';

vi.mock('axios', async () => {
  const actual = await vi.importActual('axios');
  return {
    default: {
      ...actual,
      get: vi.fn(),
      create: vi.fn(() => ({
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        },
        get: vi.fn()
      }))
    }
  };
});

describe('BinderClient', () => {
  const clientConfig = {
    supportedVersions: ['v1.0.0', 'v1.1.0', 'v1.2.0'],
    defaultVersion: 'v1.0.0'
  };

  it('should negotiate the highest common version', () => {
    const client = new BinderClient(clientConfig);
    const backendVersions = ['v1.0.0', 'v1.1.0', 'v2.0.0'];
    const version = client.negotiateVersion(backendVersions);
    expect(version).toBe('v1.1.0');
  });

  it('should fallback to default version if no common version exists', () => {
    const client = new BinderClient(clientConfig);
    const backendVersions = ['v2.0.0'];
    const version = client.negotiateVersion(backendVersions);
    expect(version).toBe('v1.0.0');
  });

  it('should fetch capabilities from backend', async () => {
    const mockCapabilities = { supported: ['v1.0.0'], current: 'v1.0.0' };
    (axios.get as any).mockResolvedValueOnce({ data: mockCapabilities });

    const client = new BinderClient(clientConfig);
    const caps = await client.fetchCapabilities('http://localhost:3000');
    
    expect(axios.get).toHaveBeenCalledWith('http://localhost:3000/api/_binder/capabilities');
    expect(caps).toEqual(mockCapabilities);
  });
});
