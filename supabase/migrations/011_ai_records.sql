-- Migration 011: a record of every MaddenAI reply (legal-risk pass, item 8).
--
-- NOT APPLIED. Apply in the Supabase SQL editor; until then the server logs
-- that records are not being kept and replies are unaffected (api/_aiRecords.js).
--
-- Written by the server only. A user can read their own records (so the data
-- export includes them) but cannot write, change or delete them. The prompt is
-- not stored — only a hash of the user's turn (see api/_aiRecords.js).

CREATE TABLE IF NOT EXISTS public.ai_records (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,   -- null for shared daily content
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  model            TEXT NOT NULL,
  purpose          TEXT NOT NULL,
  template_version TEXT NOT NULL,
  input_data_date  DATE,
  guard_version    TEXT NOT NULL,
  guard_flags      TEXT[] DEFAULT '{}' NOT NULL,
  guard_rewritten  BOOLEAN DEFAULT FALSE NOT NULL,
  guard_blocked    BOOLEAN DEFAULT FALSE NOT NULL,
  request_hash     TEXT,
  output_text      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_records_user_date ON public.ai_records (user_id, created_at);
CREATE INDEX IF NOT EXISTS ai_records_flagged ON public.ai_records (created_at) WHERE guard_rewritten OR guard_blocked;

ALTER TABLE public.ai_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own AI records" ON public.ai_records
  FOR SELECT USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policy for users: the server writes with the
-- service key (SUPABASE_SERVICE_KEY). Without it set, records are not kept.

-- Retention: two years, for complaint handling (period under legal review).
CREATE OR REPLACE FUNCTION public.purge_old_ai_records()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.ai_records WHERE created_at < NOW() - INTERVAL '730 days';
$$;

REVOKE ALL ON FUNCTION public.purge_old_ai_records() FROM PUBLIC, anon, authenticated;
-- With pg_cron enabled:
-- SELECT cron.schedule('purge-old-ai-records', '23 3 * * *', $$SELECT public.purge_old_ai_records()$$);
