import { createHmac } from "node:crypto";

// OAuth state signing/verification used by both the LINE bind flow and
// the LINE login flow. State carries an explicit mode tag so the shared
// callback route can dispatch correctly.
//
//   bind  → "bind." + invite-token + "." + nonce + "." + hmac
//   login → "login." + nonce + "." + hmac

export type OauthState =
  | { mode: "bind"; token: string; nonce: string }
  | { mode: "login"; nonce: string };

export function signBindState(token: string, nonce: string, secret: string): string {
  const payload = `bind.${token}.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function signLoginState(nonce: string, secret: string): string {
  const payload = `login.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyOauthState(state: string, secret: string): OauthState | null {
  const parts = state.split(".");
  if (parts.length === 4 && parts[0] === "bind") {
    const [, token, nonce, sig] = parts;
    const expected = createHmac("sha256", secret)
      .update(`bind.${token}.${nonce}`)
      .digest("base64url");
    if (sig !== expected) return null;
    return { mode: "bind", token, nonce };
  }
  if (parts.length === 3 && parts[0] === "login") {
    const [, nonce, sig] = parts;
    const expected = createHmac("sha256", secret)
      .update(`login.${nonce}`)
      .digest("base64url");
    if (sig !== expected) return null;
    return { mode: "login", nonce };
  }
  return null;
}

// Backwards-compat alias kept while older code paths still call it.
export const verifyBindState = (
  state: string,
  secret: string,
): { token: string; nonce: string } | null => {
  const v = verifyOauthState(state, secret);
  if (v?.mode === "bind") return { token: v.token, nonce: v.nonce };
  return null;
};
