import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];
  const requestId = Array.isArray(incomingId) ? incomingId[0] : incomingId;
  const finalId = requestId && requestId.trim() !== '' ? requestId : randomUUID();

  (req as any).requestId = finalId;
  res.setHeader('x-request-id', finalId);
  next();
}
