import { NextRequest, NextResponse } from "next/server";

/**
 * Basic auth on the dashboard (username "aangan", password DASHBOARD_PASSWORD).
 * The webhook and eval routes check their own token; email links are HMAC-signed.
 */
export function proxy(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return new NextResponse("Dashboard password not configured", { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [user, ...rest] = atob(encoded).split(":");
    if (user === "aangan" && rest.join(":") === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Aangan dashboard"' },
  });
}

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico).*)"],
};
