"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";

const UUID = /^[0-9a-f-]{36}$/i;

/** Outcome tracking from the dashboard (behind the dashboard password). */
export async function markShowedUp(form: FormData) {
  const id = String(form.get("id"));
  if (!UUID.test(id)) return;
  await sql()`update calls set showed_up = not coalesce(showed_up, false) where id = ${id}`;
  revalidatePath("/");
}

export async function markWon(form: FormData) {
  const id = String(form.get("id"));
  if (!UUID.test(id)) return;
  const value = Number(String(form.get("value") ?? "").replace(/[^\d.]/g, ""));
  await sql()`update calls set project_won = true, showed_up = true,
    project_value_inr = ${Number.isFinite(value) && value > 0 ? value : null} where id = ${id}`;
  revalidatePath("/");
}
