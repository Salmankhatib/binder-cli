import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that enforces API version negotiation.
 * Reads the "X-API-Version" header from the request, validates it against a whitelist
 * of supported versions (provided via env var or config), and adds response headers
 * indicating the selected version and optional deprecation warnings.
 */
export function versionNegotiation(options: { supportedVersions: string[]; defaultVersion: string }) {
  const { supportedVersions, defaultVersion } = options;
  return function (req: Request, res: Response, next: NextFunction) {
    const requested = (req.headers['x-api-version'] as string) || defaultVersion;
    const selected = supportedVersions.includes(requested) ? requested : defaultVersion;
    
    // Attach the selected version to the request for downstream handlers
    (req as any).apiVersion = selected;
    
    // Always expose the version in the response
    res.setHeader('X-API-Version', selected);
    
    // Optional deprecation header – for demo we set a static 30-day window if version is older than the latest
    const latest = supportedVersions[supportedVersions.length - 1];
    if (selected !== latest) {
      const deprecationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      res.setHeader('X-API-Deprecated', deprecationDate);
    }
    
    next();
  };
}
