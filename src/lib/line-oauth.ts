// Self-contained LINE OAuth client for the bind flow.
// (Login flow uses Auth.js's LINE provider — different code path.)

import { LINE_LOGIN_CHANNEL_ID, LINE_LOGIN_CHANNEL_SECRET } from "./env";

const AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export function buildLineAuthorizeUrl(args: {
  redirectUri: string;
  state: string;
  nonce: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: LINE_LOGIN_CHANNEL_ID,
    redirect_uri: args.redirectUri,
    state: args.state,
    scope: "openid profile",
    nonce: args.nonce,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeLineCode(args: {
  code: string;
  redirectUri: string;
}): Promise<{ idToken: string; accessToken: string } | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: args.code,
      redirect_uri: args.redirectUri,
      client_id: LINE_LOGIN_CHANNEL_ID,
      client_secret: LINE_LOGIN_CHANNEL_SECRET,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("LINE token exchange failed", res.status, body);
    return null;
  }
  const data = (await res.json()) as { id_token?: string; access_token?: string };
  if (!data.id_token || !data.access_token) return null;
  return { idToken: data.id_token, accessToken: data.access_token };
}

export async function verifyLineIdToken(idToken: string): Promise<string | null> {
  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: LINE_LOGIN_CHANNEL_ID }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { sub?: string };
  return data.sub ?? null;
}
