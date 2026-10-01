import { Request } from 'express';

export const getCookieValue = (req: Request, name: string): string | null => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const parts = c.trim().split('=');
      return [parts[0], parts.slice(1).join('=')];
    })
  );

  return cookies[name] || null;
};
