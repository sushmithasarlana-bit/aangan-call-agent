import type { NextConfig } from "next";

const config: NextConfig = {
  // Ship only the two knowledge files the classifier reads. pricing.md is never bundled.
  outputFileTracingIncludes: {
    "/api/vaani/webhook": ["./knowledge/qualified.md", "./knowledge/services.md"],
    "/api/eval": ["./knowledge/qualified.md", "./knowledge/services.md"],
  },
  outputFileTracingExcludes: {
    "*": ["./knowledge/pricing.md", "./docs/archive/**"],
  },
};

export default config;
