import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function verifyPassword(plain: string, hashed: string) {
  if (hashed.startsWith('$2a$') || hashed.startsWith('$2b$') || hashed.startsWith('$2y$')) {
    return bcrypt.compare(plain, hashed);
  }
  const sha = crypto.createHash('sha256').update(plain).digest('hex');
  return sha === hashed;
}

export async function hashPassword(plain: string) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plain, salt);
}
