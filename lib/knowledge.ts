import fs from "node:fs";
import path from "node:path";

/**
 * The only knowledge the classifier sees. Files are named explicitly: pricing.md is never
 * read, never bundled (next.config.ts) and never committed (.gitignore). That's the Cut.
 */
const FILES = ["qualified.md", "services.md"] as const;

let cache: Record<(typeof FILES)[number], string> | null = null;

export function knowledge() {
  cache ??= Object.fromEntries(
    FILES.map((f) => [f, fs.readFileSync(path.join(process.cwd(), "knowledge", f), "utf8")]),
  ) as Record<(typeof FILES)[number], string>;
  return cache;
}
