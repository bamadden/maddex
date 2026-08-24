-- Migration 003: Subscription tier + trial expiry
-- Safe to run multiple times (IF NOT EXISTS / OR REPLACE)

-- Add subscription_tier column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT
  DEFAULT 'trial'
  CHECK (subscription_tier IN ('trial', 'core', 'prime', 'apex'));

-- Add trial_ends_at column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ
  DEFAULT (NOW() + INTERVAL '7 days');

-- Backfill existing rows
UPDATE public.profiles
  SET trial_ends_at = created_at + INTERVAL '7 days'
  WHERE trial_ends_at IS NULL;

UPDATE public.profiles
  SET subscription_tier = 'trial'
  WHERE subscription_tier IS NULL;

-- Function to set tier + trial on new signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    country,
    subscription_tier,
    trial_ends_at
  )
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

-- Attach trigger to auth.users (replace if exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
