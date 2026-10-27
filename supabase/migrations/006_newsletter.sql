-- The Maddex Intelligence Brief (weekly newsletter) shares the waitlist table,
-- told apart by source = 'newsletter'.
--
-- The table was unique on email alone, so anyone already on the payments
-- waitlist could not also subscribe to the newsletter: the insert failed as a
-- duplicate and the terminal, reading duplicate as "already subscribed", would
-- have confirmed a subscription that was never recorded. One row per email
-- per source instead.

ALTER TABLE public.waitlist DROP CONSTRAINT IF EXISTS waitlist_email_unique;
ALTER TABLE public.waitlist
  ADD CONSTRAINT waitlist_email_source_unique UNIQUE (email, source);
