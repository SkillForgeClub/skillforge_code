import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const DEVELOPMENT_JWT_SECRET = 'skillforge-dev-secret-change-in-production';
const configuredJwtSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && (
  !configuredJwtSecret ||
  configuredJwtSecret.length < 32 ||
  configuredJwtSecret === DEVELOPMENT_JWT_SECRET
)) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters in production.');
}

export const JWT_SECRET = configuredJwtSecret || DEVELOPMENT_JWT_SECRET;

export interface AuthPayload {
  id: string;
  role: 'student' | 'admin';
  email: string;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export interface AuthedRequest extends Request {
  user?: AuthPayload;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator privileges required.' });
  }
  next();
}

/** Optional auth: attaches req.user if a valid token is present, but never blocks the request. */
export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice('Bearer '.length), JWT_SECRET) as AuthPayload;
    } catch {
      /* ignore invalid token for optional auth */
    }
  }
  next();
}
