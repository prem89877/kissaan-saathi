-- =====================================================================
-- 24_cod_collected_at.sql
--
-- Purpose: support an aging warning for COD cash that's been collected
-- but not yet deposited/confirmed (flagged in
-- 22_link_cod_deposit_to_farmer_settlement.sql). Adds one nullable
-- timestamp column; the accompanying app/api/delivery/collect-cod route
-- change sets it going forward. Orders collected before this migration
-- will simply have it null (harmless — the admin page treats null as
-- "unknown age", not zero).
--
-- Run ONCE in Supabase Dashboard > SQL Editor. Safe to re-run (idempotent).
-- =====================================================================

alter table public.orders add column if not exists cod_collected_at timestamptz;
