/** Chart series shared by server pages and the client chart. */
export type Bucket = { label: string; sub: string; qualified: number; not_fit: number; complaint: number; unclear: number };

// Stack order is part of the colour-blind safety check (validated adjacent pairs, light and dark).
export const SERIES = [
  { key: "qualified", label: "Qualified", color: "var(--s-qualified)" },
  { key: "not_fit", label: "Not a fit", color: "var(--s-notfit)" },
  { key: "complaint", label: "Complaint", color: "var(--s-complaint)" },
  { key: "unclear", label: "Unclear or review", color: "var(--s-unclear)" },
] as const;
