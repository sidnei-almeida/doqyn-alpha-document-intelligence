import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  createSessionToken,
  getSessionMaxAgeSeconds,
  setSessionCookie,
} from '../../server/auth/session.js';
import { getTemporaryUser, isTemporaryAuthEnabled } from '../../server/auth/tempUser.js';

const REMEMBER_ME_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

function getBody(req: VercelRequest) {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }

  return req.body;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isTemporaryAuthEnabled()) {
    return res.status(403).json({ error: 'Temporary auth is disabled' });
  }

  try {
    const body = loginSchema.parse(getBody(req));

    const user = getTemporaryUser();
    const passwordHash = process.env.TEMP_ADMIN_PASSWORD_HASH;

    if (!passwordHash) {
      return res.status(500).json({ error: 'Temporary auth is not configured' });
    }

    const emailMatches = body.email.toLowerCase().trim() === user.email;
    const passwordMatches = await bcrypt.compare(body.password, passwordHash);

    if (!emailMatches || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const sessionMaxAge = body.rememberMe
      ? REMEMBER_ME_MAX_AGE_SECONDS
      : getSessionMaxAgeSeconds();

    const token = await createSessionToken(user, sessionMaxAge);

    setSessionCookie(res, token, sessionMaxAge);

    return res.status(200).json({
      user,
    });
  } catch {
    return res.status(400).json({
      error: 'Invalid request',
    });
  }
}
