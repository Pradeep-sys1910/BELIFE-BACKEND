import { Request, Response, NextFunction } from 'express';
import { getFirebaseAdmin } from '../lib/firebase';

/**
 * App Check enforcement — the wall against cracked / repackaged mobile builds.
 *
 * Threat model: the same backend serves the public website/admin (browsers) AND
 * the native app. Browsers always send an `Origin` header and are governed by the
 * CORS allowlist; the native app sends NO `Origin`. So:
 *
 *   - Request HAS an Origin  → treat as web (website/admin). App Check not required.
 *   - Request has NO Origin  → treat as app traffic. A valid Play-Integrity-backed
 *                              App Check token is REQUIRED, else 401/403.
 *
 * A repackaged APK is signed with a different key and cannot mint a valid token, so
 * it is rejected here. (Honest caveat: a non-browser client could spoof an allowlisted
 * Origin to be treated as "web" — but it then only gets the public website's surface,
 * nothing app-exclusive. True app-only isolation would need a separate app subdomain.)
 *
 * Gated behind `APP_CHECK_ENFORCED=true`. While off (default), this is a pass-through,
 * so the website, admin, Expo Go and any non-EAS build keep working unchanged. Turn it
 * on only once a real EAS build + Firebase console setup are in place.
 */
export async function verifyAppCheck(req: Request, res: Response, next: NextFunction) {
  if (process.env.APP_CHECK_ENFORCED !== 'true') return next();

  // Browser traffic (website + admin) carries an Origin; CORS already governs it.
  if (req.headers.origin) return next();

  const token = req.header('X-Firebase-AppCheck');
  if (!token) {
    return res.status(401).json({ message: 'App attestation required.' });
  }

  const fb = getFirebaseAdmin();
  if (!fb) {
    // Enforcement is on but Admin isn't configured — fail closed for app traffic
    // rather than silently letting unattested requests through.
    console.error('⚠️  APP_CHECK_ENFORCED=true but Firebase Admin is not configured.');
    return res.status(503).json({ message: 'Attestation temporarily unavailable.' });
  }

  try {
    await fb.appCheck().verifyToken(token);
    return next();
  } catch {
    return res.status(403).json({ message: 'Invalid app attestation.' });
  }
}
