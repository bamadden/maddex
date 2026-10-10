-- Payments waitlist — emails captured by the terminal's "payments coming soon"
-- modal (src/components/billing/PlanOverlays.jsx) so they can be emailed at
-- launch. Insert-only for the public: anyone may join, nobody may read the list
-- from the client. Read it with the service role (dashboard / server).

CREATE TABLE IF NOT EXISTS public.waitlist (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT NOT NULL,
  tier       TEXT CHECK (tier IN ('prime', 'apex')),
  source     TEXT DEFAULT 'terminal',
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT waitlist_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  CONSTRAINT waitlist_email_unique UNIQUE (email)
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join the waitlist" ON public.waitlist
  FOR INSERT TO anon, authenticated WITH CHECK (true);
