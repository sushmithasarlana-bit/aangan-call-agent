import { optionalEnv } from "./env";

/** Creates a HubSpot deal. Returns null (skipped) when no token is configured. */
export async function createDeal(p: { name: string; description: string; closeDate?: string | null }): Promise<string | null> {
  const token = optionalEnv("HUBSPOT_PRIVATE_APP_TOKEN");
  if (!token) return null;
  const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      properties: {
        dealname: p.name.slice(0, 250),
        pipeline: "default",
        dealstage: "appointmentscheduled",
        description: p.description.slice(0, 5000),
        ...(p.closeDate ? { closedate: p.closeDate } : {}),
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HubSpot ${res.status}: ${json?.message ?? "deal create failed"}`);
  return json.id;
}
