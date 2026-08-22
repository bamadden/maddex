-- ============================================================
-- COPY THIS SQL AND RUN IN SUPABASE SQL EDITOR
-- ============================================================

-- Subscription tier + trial expiry
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'trial'
    CHECK (subscription_tier IN ('trial', 'core', 'prime', 'apex'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');

-- Backfill any existing rows that predate this migration
UPDATE public.profiles
  SET trial_ends_at = created_at + INTERVAL '7 days'
  WHERE trial_ends_at IS NULL;

UPDATE public.profiles
  SET subscription_tier = 'trial'
  WHERE subscription_tier IS NULL;

-- New signups: set both explicitly on insert, independent of the column
-- defaults above (matches useSubscription's assumption that every profile
-- has a tier and a trial end date from the moment it's created).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, country, subscription_tier, trial_ends_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'country',
    'trial',
    NOW() + INTERVAL '7 days'
  );
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
