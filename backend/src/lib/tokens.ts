import { createHash, randomBytes } from 'node:crypto';

export const createRefreshToken = () => randomBytes(48).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
