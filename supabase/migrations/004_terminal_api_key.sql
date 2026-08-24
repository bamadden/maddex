-- Migration 004: Terminal API key (Apex tier)
-- Safe to run multiple times

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_api_key ON public.profiles (api_key) WHERE api_key IS NOT NULL;
