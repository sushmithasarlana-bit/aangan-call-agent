import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { env } from "./env";

let client: NeonQueryFunction<false, false> | null = null;

/** Neon over HTTP: one round trip per query, no pool to manage in serverless functions. */
export function sql() {
  client ??= neon(env("DATABASE_URL"));
  return client;
}
