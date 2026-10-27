-- Users must not be able to change their own plan.
--
-- 001's "Users can update own profile" policy covers every column, so any
-- signed-in user could run
--   supabase.from('profiles').update({ subscription_tier: 'apex' }).eq('id', me)
-- from the browser console and unlock every paid gate, or push trial_ends_at
-- into the next century. The client only ever READS these two columns
-- (useSubscription, useProfile, plans.effectiveTier), so blocking writes from
-- the API roles changes nothing the app does. Billing (Stripe webhook, using
-- the service role) and the SQL editor are unaffected: auth.role() is
-- 'service_role' or NULL there.
--
-- Found in the 27 Oct 2026 launch audit.

CREATE OR REPLACE FUNCTION public.protect_plan_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.subscription_tier := 'trial';
      NEW.trial_ends_at := NOW() + INTERVAL '7 days';
    ELSIF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
       OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
      RAISE EXCEPTION 'subscription_tier and trial_ends_at are managed by billing'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_plan_columns ON public.profiles;
CREATE TRIGGER protect_plan_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_plan_columns();
