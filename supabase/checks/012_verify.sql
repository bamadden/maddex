-- Checks migration 012 (docs/MIGRATION_012.md). Safe to run any number of
-- times, before or after applying it: it tries a few inserts as the public
-- (anon) role and then ALWAYS rolls back, so nothing is kept. The result is
-- shown as the error message, e.g.
--   ERROR: RESULT: PASS launch-site refused | PASS newsletter refused | …
-- An error is how it reports: the error is what undoes the test inserts.
-- Before 012 is applied, expect FAIL lines (that is the hole it closes);
-- after, every line should read PASS.

BEGIN;
SET LOCAL ROLE anon;
DO $$
DECLARE
  res text := '';
BEGIN
  -- 1. A launch-site row (only /api/waitlist may write these, once confirmed)
  BEGIN
    INSERT INTO public.waitlist (email, source) VALUES ('rls-check-1@example.invalid', 'launch-site');
    res := res || 'FAIL launch-site accepted | ';
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'PASS launch-site refused | ';
            WHEN OTHERS THEN res := res || 'CHECK launch-site: ' || SQLSTATE || ' | ';
  END;
  -- 2. A newsletter row (double opt-in through /api/waitlist since 26 Nov)
  BEGIN
    INSERT INTO public.waitlist (email, source) VALUES ('rls-check-2@example.invalid', 'newsletter');
    res := res || 'FAIL newsletter accepted | ';
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'PASS newsletter refused | ';
            WHEN OTHERS THEN res := res || 'CHECK newsletter: ' || SQLSTATE || ' | ';
  END;
  -- 3. A back-dated terminal row
  BEGIN
    INSERT INTO public.waitlist (email, source, created_at) VALUES ('rls-check-3@example.invalid', 'terminal', '2020-01-01');
    res := res || 'FAIL back-dated row accepted | ';
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'PASS back-dated row refused | ';
            WHEN OTHERS THEN res := res || 'CHECK back-dated: ' || SQLSTATE || ' | ';
  END;
  -- 4. A terminal row claiming someone's account (anon has no account)
  BEGIN
    INSERT INTO public.waitlist (email, source, user_id) VALUES ('rls-check-4@example.invalid', 'terminal', gen_random_uuid());
    res := res || 'FAIL row for another account accepted | ';
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'PASS row for another account refused | ';
            WHEN foreign_key_violation THEN res := res || 'CHECK row for another account: refused by the foreign key, not the policy | ';
            WHEN OTHERS THEN res := res || 'CHECK other account: ' || SQLSTATE || ' | ';
  END;
  -- 5. What the terminal's payments waitlist sends: must still work
  BEGIN
    INSERT INTO public.waitlist (email, tier, source) VALUES ('rls-check-5@example.invalid', 'apex', 'terminal');
    res := res || 'PASS terminal row accepted (rolled back)';
  EXCEPTION WHEN OTHERS THEN res := res || 'FAIL terminal row refused: ' || SQLSTATE;
  END;
  RAISE EXCEPTION 'RESULT: %', res;
END $$;
ROLLBACK;
