import { createHmac } from "node:crypto";

export function signBindState(token: string, nonce: string, secret: string): string {
  const payload = `${token}.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyBindState(
  state: string,
  secret: string,
): { token: string; nonce: string } | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [token, nonce, sig] = parts;
  const expected = createHmac("sha256", secret).update(`${token}.${nonce}`).digest("base64url");
  if (sig !== expected) return null;
  return { token, nonce };
}
