// Security Headers Middleware for Cloudflare Pages
// Adds security headers to all responses

export const onRequest: PagesFunction = async (context) => {
  const response = await context.next();

  // Clone response to modify headers
  const newResponse = new Response(response.body, response);

  // ─── Content Security Policy ───
  // Configured to whitelist all resources used by the app:
  // - Turnstile CAPTCHA (challenges.cloudflare.com)
  // - Bapenda logo (bapenda.kalselprov.go.id)
  // - Inline styles (React/framer-motion)
  // - data: URIs (device photos, document previews)
  // - blob: URIs (file downloads, photo uploads)
  // - PWA service worker
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://bapenda.kalselprov.go.id data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "media-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  newResponse.headers.set('Content-Security-Policy', csp);

  // ─── Prevent Clickjacking ───
  newResponse.headers.set('X-Frame-Options', 'DENY');

  // ─── Prevent MIME Sniffing ───
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');

  // ─── Control Referrer Information ───
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // ─── Force HTTPS (2 year max-age) ───
  newResponse.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // ─── Restrict Browser Features ───
  newResponse.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()');

  // ─── Prevent XSS in older browsers ───
  newResponse.headers.set('X-XSS-Protection', '1; mode=block');

  return newResponse;
};
