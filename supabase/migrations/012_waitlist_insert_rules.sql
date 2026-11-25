-- Migration 012: what the public (anon) key may insert into the waitlist.
--
-- NOT APPLIED. Ben applies it in the Supabase SQL Editor; the steps, the
-- verification and the rollback are in docs/MIGRATION_012.md. Apply it only
-- AFTER the release that moves the newsletter sign-up to /api/waitlist is
-- live (26 Nov 2026), or the terminal's newsletter sign-up stops working.
--
-- Before: "Anyone can join the waitlist" let the anon key insert ANY row:
-- any source (so a 'launch-site' or 'newsletter' row could be created
-- without the owner ever confirming, which defeats double opt-in), any
-- user_id (someone else's account), any created_at (a back-dated row).
--
-- After: the anon key, and a signed-in user's key, may insert only a
-- payments-waitlist row from the terminal: source 'terminal', user_id empty
-- or their own, created_at now. Newsletter and launch-site rows can only be
-- written by /api/waitlist, which uses the service key (it bypasses
-- row-level security) and writes a row only once its owner has confirmed.
--
-- Existing rows are not touched: this changes a policy, not data.

DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "The terminal may add a payments waitlist row" ON public.waitlist;

CREATE POLICY "The terminal may add a payments waitlist row" ON public.waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    source = 'terminal'
    AND (user_id IS NULL OR user_id = auth.uid())
    AND created_at BETWEEN NOW() - INTERVAL '5 minutes' AND NOW() + INTERVAL '5 minutes'
  );

-- No SELECT, UPDATE or DELETE policy, as before: the list cannot be read,
-- changed or emptied with the public key. Only the service key can.
