-- Server-side MaddenAI usage, for the daily limits /api/claude enforces
-- (api/_aiGuard.js). One row per model call, written before the call and
-- given its token counts after.
--
-- purpose: 'chat' (a MaddenAI question — counts against the plan's daily
-- questions) or 'feature' (brief, themes, ticker… — counts against the daily
-- ceiling only).
--
-- The guard writes with SUPABASE_SERVICE_KEY when that is set in Vercel and
-- otherwise as the signed-in user, so users may insert and update their own
-- rows. There is deliberately no DELETE policy: a user cannot clear their own
-- count to get more calls.

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  model         TEXT NOT NULL,
  purpose       TEXT NOT NULL DEFAULT 'feature' CHECK (purpose IN ('chat', 'feature')),
  input_tokens  INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_user_date ON public.ai_usage (user_id, created_at);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own usage" ON public.ai_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users record own usage" ON public.ai_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own usage tokens" ON public.ai_usage
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
