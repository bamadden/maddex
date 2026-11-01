-- Migration 010: retention for usage records (legal-risk pass, item 7).
--
-- NOT APPLIED. Apply in the Supabase SQL editor when ready; nothing in the app
-- depends on it. The Privacy Policy draft states these periods.
--
-- ai_usage holds one row per MaddenAI request (time, model, purpose, tokens)
-- for the plan's daily limits, which only need the last 24 hours. Rows older
-- than 90 days are deleted. No prompt text is stored anywhere in Maddex.

CREATE OR REPLACE FUNCTION public.purge_old_usage()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.ai_usage WHERE created_at < NOW() - INTERVAL '90 days';
$$;

REVOKE ALL ON FUNCTION public.purge_old_usage() FROM PUBLIC, anon, authenticated;

-- Run it daily. Requires the pg_cron extension (Database → Extensions in the
-- Supabase dashboard). Uncomment once enabled:
-- SELECT cron.schedule('purge-old-usage', '17 3 * * *', $$SELECT public.purge_old_usage()$$);
