import admin from 'firebase-admin';

/**
 * Lazily initialise the Firebase Admin SDK, used to verify App Check tokens
 * (the attestation that a request comes from the genuine, Play-installed app).
 *
 * Credentials come from the `FIREBASE_SERVICE_ACCOUNT` env var, which holds the
 * full service-account JSON (paste it into Render as a single value). If unset,
 * we fall back to Application Default Credentials, and otherwise return null so
 * callers can degrade gracefully instead of crashing the server.
 */
let app: admin.app.App | null = null;
let tried = false;

export function getFirebaseAdmin(): admin.app.App | null {
  if (app) return app;
  if (tried) return null; // don't retry a known-bad config on every request
  tried = true;

  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
    if (raw) {
      const creds = JSON.parse(raw);
      app = admin.initializeApp({ credential: admin.credential.cert(creds) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
      app = admin.initializeApp(); // Application Default Credentials from file path
    } else {
      return null;
    }
    return app;
  } catch (e) {
    console.error('❌ Failed to initialise Firebase Admin:', (e as Error).message);
    return null;
  }
}
