/**
 * Rewrites a localhost URL to 127.0.0.1. Node's fetch does not fall back from ::1 to
 * IPv4 the way browsers and curl do, and on Windows localhost often resolves to ::1 only,
 * while a Fuseki behind an SSH tunnel listens on 127.0.0.1.
 */
export function ipv4Loopback (url: string): string {
  const u = new URL(url)
  if (u.hostname !== 'localhost') return url
  u.hostname = '127.0.0.1'
  return u.toString()
}
