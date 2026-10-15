/** cookie-parser types req.cookies as `any`, so read it as unknown and narrow. */
export function readCookie(cookies: unknown, name: string): string | null {
  if (typeof cookies !== 'object' || cookies === null) return null;
  const value: unknown = (cookies as Record<string, unknown>)[name];
  return typeof value === 'string' && value !== '' ? value : null;
}
