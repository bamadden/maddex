-- ============================================================
-- COPY THIS SQL AND RUN IN SUPABASE SQL EDITOR
-- ============================================================

-- Add experience_level to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS experience_level TEXT DEFAULT 'INTERMEDIATE'
    CHECK (experience_level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL'));

-- Drop phone column (no longer used)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;
