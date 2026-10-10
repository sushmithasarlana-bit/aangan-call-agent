/** Required env var: throws a clear error if it's missing. */
export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

/** Optional env var: undefined when unset or empty. */
export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export function numEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && process.env[name] !== "" ? n : fallback;
}

/** Public base URL for links in emails. Vercel sets VERCEL_PROJECT_PRODUCTION_URL automatically. */
export function appUrl(): string {
  const explicit = optionalEnv("APP_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = optionalEnv("VERCEL_PROJECT_PRODUCTION_URL");
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}
