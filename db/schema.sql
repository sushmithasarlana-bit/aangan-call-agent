-- Aangan call agent: Neon Postgres schema. Run once (idempotent).
-- Only the server touches this database (DATABASE_URL lives in Vercel env), so there is
-- no public API to lock down with RLS, unlike the Supabase version in the class guide.

create table if not exists designers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  specialties text[] not null default '{}',   -- {home} and/or {office}
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists calls (
  id                      uuid primary key default gen_random_uuid(),
  vaani_call_id           text unique not null,
  caller_number           text,
  status                  text,
  started_at              timestamptz,
  ended_at                timestamptz,
  duration_sec            integer not null default 0,
  after_hours             boolean,
  recording_url           text,
  summary                 text,
  collected               jsonb not null default '{}'::jsonb,   -- Vaani entities
  transcript              jsonb not null default '[]'::jsonb,   -- [{role, text}]
  last_payload            jsonb,                                 -- raw Vaani webhook, for debugging

  -- Classification (Gemini against qualified.md + services.md)
  classification          text check (classification in ('qualified','not_fit','complaint','unclear')),
  fit_reason              text,
  asked_pricing           boolean not null default false,
  segment                 text,                                  -- home | office | unknown
  lead                    jsonb not null default '{}'::jsonb,
  handoff_note            text,
  ai_error                text,
  processed_at            timestamptz,                           -- idempotency latch

  -- Handoff
  designer_id             uuid references designers(id),
  booked_slot             timestamptz,
  handoff_sent_at         timestamptz,
  email_message_id        text,
  hubspot_deal_id         text,
  output_errors           text[] not null default '{}',
  claimed_by              text,
  claimed_at              timestamptz,
  reschedule_requested_at timestamptz,

  -- Outcomes (marked from the dashboard)
  showed_up               boolean,
  project_won             boolean,
  project_value_inr       numeric,

  -- Running cost
  cost_voice_inr          numeric not null default 0,
  cost_llm_inr            numeric not null default 0,

  created_at              timestamptz not null default now()
);

create index if not exists calls_started_idx on calls (coalesce(started_at, created_at) desc);

create or replace view daily_metrics as
select
  (coalesce(started_at, created_at) at time zone 'Asia/Kolkata')::date        as day,
  count(*)                                                                    as calls,
  count(*) filter (where after_hours)                                         as after_hours_calls,
  count(*) filter (where classification = 'qualified')                        as qualified,
  count(*) filter (where booked_slot is not null)                             as booked,
  count(*) filter (where showed_up)                                           as showed_up,
  count(*) filter (where project_won)                                         as won,
  coalesce(sum(project_value_inr) filter (where project_won), 0)              as won_value_inr,
  round(sum(cost_voice_inr + cost_llm_inr)::numeric, 2)                       as cost_inr,
  round(avg(extract(epoch from handoff_sent_at - ended_at))
        filter (where handoff_sent_at is not null and ended_at is not null))  as avg_handoff_sec
from calls
group by 1
order by 1 desc;

-- Add at least one designer. With Resend's sandbox sender, use your Resend signup email:
-- insert into designers (name, email, specialties) values ('Test Designer', 'you@example.com', '{home,office}');
