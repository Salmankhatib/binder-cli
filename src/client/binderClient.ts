import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

interface CapabilitiesResponse {
  supported: string[];
  current: string;
}

/**
 * BinderClient handles version negotiation with the backend.
 * It fetches supported versions from the backend and ensures requests
 * include the correct X-API-Version header.
 */
export class BinderClient {
  private supportedVersions: string[];
  private defaultVersion: string;
  private backendCapabilities: CapabilitiesResponse | null = null;

  constructor(config: { supportedVersions: string[]; defaultVersion: string }) {
    this.supportedVersions = config.supportedVersions;
    this.defaultVersion = config.defaultVersion;
  }

  /**
   * Fetches capabilities from the backend.
   */
  async fetchCapabilities(baseUrl: string): Promise<CapabilitiesResponse> {
    try {
      const response = await axios.get<CapabilitiesResponse>(`${baseUrl}/api/_binder/capabilities`);
      this.backendCapabilities = response.data;
      return response.data;
    } catch (error) {
      console.error('Failed to fetch Binder capabilities:', error);
      throw error;
    }
  }

  /**
   * Negotiates the highest mutually supported version.
   */
  negotiateVersion(backendVersions: string[]): string {
    const common = this.supportedVersions.filter(v => backendVersions.includes(v));
    if (common.length === 0) return this.defaultVersion;
    
    // Simple sort for semver-like strings
    return common.sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }))[0];
  }

  /**
   * Creates an Axios instance that automatically handles version negotiation.
   */
  createAxiosInstance(baseUrl: string, config: AxiosRequestConfig = {}): AxiosInstance {
    const instance = axios.create({
      baseURL: baseUrl,
      ...config,
    });

    instance.interceptors.request.use(async (req) => {
      if (!this.backendCapabilities) {
        await this.fetchCapabilities(baseUrl);
      }

      if (this.backendCapabilities) {
        const version = this.negotiateVersion(this.backendCapabilities.supported);
        req.headers['X-API-Version'] = version;
      }

      return req;
    });

    instance.interceptors.response.use((res) => {
      const deprecationDate = res.headers['x-api-deprecated'];
      if (deprecationDate) {
        const date = new Date(deprecationDate);
        if (date < new Date()) {
          console.warn(`[Binder] API version ${res.headers['x-api-version']} is DEPRECATED as of ${deprecationDate}. Please upgrade.`);
        }
      }
      return res;
    });

    return instance;
  }
}
