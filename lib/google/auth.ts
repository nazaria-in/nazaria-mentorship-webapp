// /lib/google/auth.ts

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface CachedAccessToken {
  token: string;
  expiresAt: number;
}

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/**
 * Refresh the token 5 minutes before Google says it expires.
 */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

let cachedToken: CachedAccessToken | null = null;

/**
 * Ensure all required environment variables exist.
 */
function getGoogleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId) {
    throw new Error("Missing GOOGLE_CLIENT_ID");
  }

  if (!clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_SECRET");
  }

  if (!refreshToken) {
    throw new Error("Missing GOOGLE_REFRESH_TOKEN");
  }

  return {
    clientId,
    clientSecret,
    refreshToken,
  };
}

/**
 * Returns true if our cached access token is still usable.
 */
function hasValidCachedToken(): boolean {
  if (!cachedToken) {
    return false;
  }

  return Date.now() < cachedToken.expiresAt;
}

/**
 * Request a brand-new access token using the refresh token.
 */
async function refreshAccessToken(): Promise<string> {
  console.info("[Google Auth] Refreshing access token...");

  const { clientId, clientSecret, refreshToken } =
    getGoogleCredentials();

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();

    console.error("[Google Auth] Token refresh failed.");

    throw new Error(
      `Failed to refresh Google access token.\nStatus: ${response.status}\n${error}`
    );
  }

  const tokenData = (await response.json()) as GoogleTokenResponse;

  cachedToken = {
    token: tokenData.access_token,
    expiresAt:
      Date.now() +
      tokenData.expires_in * 1000 -
      REFRESH_BUFFER_MS,
  };

  console.info("[Google Auth] Access token refreshed.");

  return cachedToken.token;
}

/**
 * Returns a valid Google access token.
 *
 * Uses an in-memory cache whenever possible.
 */
export async function getGoogleAccessToken(): Promise<string> {
  if (hasValidCachedToken()) {
    console.debug("[Google Auth] Using cached access token.");

    return cachedToken!.token;
  }

  return refreshAccessToken();
}

/**
 * Clears the cached access token.
 *
 * Mainly useful for testing or forcing a refresh.
 */
export function clearGoogleTokenCache(): void {
  cachedToken = null;
}