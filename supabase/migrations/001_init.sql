-- 001_init.sql (Supabase init)
-- Paste this whole script into Supabase SQL Editor and run it.

-- 1) Extensions
create extension if not exists "pgcrypto";

-- 2) Enum for status (includes Delete)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_enum') THEN
    CREATE TYPE public.status_enum AS ENUM ('New', 'In progress', 'Done', 'Not impacted', 'Delete');
  END IF;
END$$;

-- 3) Table
create table if not exists public.test_cases (
  id uuid primary key default gen_random_uuid(),
  test_case_id integer not null,
  team text not null check (team in ('Pricing to Quotation','Quotation to Pricing')),
  description text not null,
  status public.status_enum not null default 'New',
  created_at timestamptz not null default now()
);

-- 4) Indexes
create index if not exists idx_test_cases_created_at on public.test_cases (created_at desc);

-- Optional for richer realtime payloads
-- alter table public.test_cases replica identity full;

-- 5) RLS + demo-open policies (adjust for production)
alter table public.test_cases enable row level security;

DROP POLICY IF EXISTS "Public read"   ON public.test_cases;
DROP POLICY IF EXISTS "Public insert" ON public.test_cases;
DROP POLICY IF EXISTS "Public update" ON public.test_cases;
DROP POLICY IF EXISTS "Public delete" ON public.test_cases;

CREATE POLICY "Public read"   ON public.test_cases FOR SELECT USING (true);
CREATE POLICY "Public insert" ON public.test_cases FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update" ON public.test_cases FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete" ON public.test_cases FOR DELETE USING (true);