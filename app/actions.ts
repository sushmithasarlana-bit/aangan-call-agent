"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { COUNT_KEYS, isMeasure } from "@/lib/metrics";

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

// ---------- Custom metrics ----------

function readMetric(form: FormData) {
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const kind = form.get("kind") === "rate" ? "rate" : "value";
  const measure = String(form.get("measure") ?? "");
  const denominator = kind === "rate" ? String(form.get("denominator") ?? "") : null;
  const rawTarget = String(form.get("target") ?? "").replace(/[^\d.]/g, "");
  const target = rawTarget === "" ? null : Number(rawTarget);
  const higher = form.get("direction") !== "lower";

  if (!name) return { error: "Give the metric a name." };
  if (!isMeasure(measure)) return { error: "Pick what to measure." };
  if (kind === "rate") {
    if (!isMeasure(denominator)) return { error: "Pick what to divide by." };
    if (!COUNT_KEYS.includes(measure) || !COUNT_KEYS.includes(denominator)) return { error: "A rate divides one count by another count." };
    if (measure === denominator) return { error: "A rate needs two different counts." };
  }
  if (target !== null && (!Number.isFinite(target) || target < 0)) return { error: "The target must be a positive number." };
  return { name, kind, measure, denominator, target, higher };
}

const back = (msg: string, anchor = "new") => redirect(`/metrics?error=${encodeURIComponent(msg)}#${anchor}`);

export async function createMetric(form: FormData) {
  const m = readMetric(form);
  if ("error" in m) return back(m.error!);
  await sql()`insert into metrics (name, kind, measure, denominator, target, higher_is_better, position)
    values (${m.name}, ${m.kind}, ${m.measure}, ${m.denominator}, ${m.target}, ${m.higher},
            (select coalesce(max(position), 0) + 1 from metrics))`;
  revalidatePath("/", "layout");
  redirect(`/metrics?saved=${encodeURIComponent(m.name)}`);
}

export async function updateMetric(form: FormData) {
  const id = String(form.get("id"));
  if (!UUID.test(id)) return;
  const m = readMetric(form);
  if ("error" in m) return back(m.error!, id);
  await sql()`update metrics set name = ${m.name}, kind = ${m.kind}, measure = ${m.measure}, denominator = ${m.denominator},
    target = ${m.target}, higher_is_better = ${m.higher}, updated_at = now() where id = ${id}`;
  revalidatePath("/", "layout");
  redirect(`/metrics?saved=${encodeURIComponent(m.name)}`);
}

export async function deleteMetric(form: FormData) {
  const id = String(form.get("id"));
  if (!UUID.test(id)) return;
  await sql()`delete from metrics where id = ${id}`;
  revalidatePath("/", "layout");
  redirect("/metrics?removed=1");
}

export async function moveMetric(form: FormData) {
  const id = String(form.get("id"));
  const dir = form.get("dir") === "up" ? -1 : 1;
  if (!UUID.test(id)) return;
  const rows = (await sql()`select id from metrics order by position, created_at`) as { id: string }[];
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await sql().transaction(rows.map((r, k) => sql()`update metrics set position = ${k + 1} where id = ${r.id}`));
  revalidatePath("/", "layout");
}

// ---------- Profile ----------

const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export async function saveProfile(form: FormData) {
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const role = String(form.get("role") ?? "").trim().slice(0, 80);
  const email = String(form.get("email") ?? "").trim().slice(0, 120);
  const photo = String(form.get("photo") ?? "");
  const removePhoto = form.get("remove_photo") === "1";

  if (!name) redirect("/profile?error=" + encodeURIComponent("Your name can't be empty."));
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/profile?error=" + encodeURIComponent("That email address doesn't look right."));
  if (photo && (!PHOTO.test(photo) || photo.length > 400_000)) redirect("/profile?error=" + encodeURIComponent("Use a JPEG, PNG or WebP image."));

  if (removePhoto) {
    await sql()`update profile set name = ${name}, role = ${role || "Founder"}, email = ${email || null}, photo = null, updated_at = now() where id = 1`;
  } else if (photo) {
    await sql()`update profile set name = ${name}, role = ${role || "Founder"}, email = ${email || null}, photo = ${photo}, updated_at = now() where id = 1`;
  } else {
    await sql()`update profile set name = ${name}, role = ${role || "Founder"}, email = ${email || null}, updated_at = now() where id = 1`;
  }
  revalidatePath("/", "layout");
  redirect("/profile?saved=1");
}
