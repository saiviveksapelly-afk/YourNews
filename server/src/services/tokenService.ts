import jwt from 'jsonwebtoken';

export function createAuthToken(userId: string): string {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign(
    { sub: userId },
    jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: '1h',
    },
  );
}
