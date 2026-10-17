import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/database.js';

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only apply to state-modifying requests
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  if (!idempotencyKey) {
    return next();
  }

  const userId = req.user?.id || 'anonymous';
  const requestPath = req.baseUrl + req.path;
  const paramsHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(req.body || {}))
    .digest('hex');

  // Check if idempotency record exists
  const existing = db.get<{
    idempotency_key: string;
    user_id: string;
    status_code: number;
    response_body: string;
  }>(
    `SELECT idempotency_key, user_id, status_code, response_body
     FROM idempotency_keys
     WHERE idempotency_key = ?`,
    [idempotencyKey]
  );

  if (existing) {
    res.setHeader('X-Idempotent-Replay', 'true');
    res.setHeader('Content-Type', 'application/json');
    res.status(existing.status_code).send(existing.response_body);
    return;
  }

  // Intercept response to store result
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  let capturedBody: string | null = null;

  res.json = (body: any): Response => {
    capturedBody = JSON.stringify(body);
    saveIdempotency(idempotencyKey, userId, requestPath, paramsHash, res.statusCode, capturedBody);
    return originalJson(body);
  };

  res.send = (body: any): Response => {
    if (typeof body === 'object') {
      capturedBody = JSON.stringify(body);
    } else {
      capturedBody = String(body);
    }
    saveIdempotency(idempotencyKey, userId, requestPath, paramsHash, res.statusCode, capturedBody);
    return originalSend(body);
  };

  next();
}

function saveIdempotency(
  key: string,
  userId: string,
  path: string,
  hash: string,
  statusCode: number,
  body: string
) {
  try {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    db.run(
      `INSERT OR REPLACE INTO idempotency_keys
       (idempotency_key, user_id, request_path, request_params_hash, status_code, response_body, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [key, userId, path, hash, statusCode, body, now, expiresAt]
    );
  } catch (err) {
    console.error('Failed to save idempotency key:', err);
  }
}
