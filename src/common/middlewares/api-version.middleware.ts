import { Request, Response, NextFunction } from 'express';

export type ApiVersion = 'v1' | 'v2';

declare global {
  namespace Express {
    interface Request {
      apiVersion?: ApiVersion;
    }
  }
}

const VERSION_PATTERN = /^\/api\/(v1|v2)\//;

export function apiVersionMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const match = req.path.match(VERSION_PATTERN);
  if (match) {
    req.apiVersion = match[1] as ApiVersion;
  }
  next();
}

export function requireApiVersion(...versions: ApiVersion[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.apiVersion || !versions.includes(req.apiVersion)) {
      res.status(400).json({
        success: false,
        message: `API version required. Supported: ${versions.join(', ')}`,
      });
      return;
    }
    next();
  };
}
