import crypto from "node:crypto";
import { appUrl, env } from "./env";

export const LEAD_ACTIONS = ["claim", "reschedule"] as const;
export type LeadAction = (typeof LEAD_ACTIONS)[number];

const TTL_DAYS = 14;

function sign(id: string, action: string, exp: number): string {
  return crypto.createHmac("sha256", env("LINK_SECRET")).update(`${id}.${action}.${exp}`).digest("base64url");
}

/** Signed one-tap link for the designer email. Opening it only shows a confirm page. */
export function actionUrl(id: string, action: LeadAction): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_DAYS * 86400;
  const q = new URLSearchParams({ id, exp: String(exp), sig: sign(id, action, exp) });
  return `${appUrl()}/api/lead/${action}?${q}`;
}

export function verifyLink(id: string, action: string, exp: string, sig: string): boolean {
  const e = Number(exp);
  if (!id || !sig || !Number.isFinite(e) || e < Date.now() / 1000) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(id, action, e));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
