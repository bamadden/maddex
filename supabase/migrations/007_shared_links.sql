-- Share links — watchlists, research notes and portfolio snapshots that anyone
-- with the link can open, signed in or not.
--
-- Until this table existed a share link was written to the creator's
-- localStorage only, so it resolved in their browser and nowhere else.
--
-- Signed-in users insert their own rows. Nobody can SELECT the table: a link
-- is read one id at a time through get_shared_link(), so the set of shares
-- cannot be listed or scraped. Ids are random UUIDs.

CREATE TABLE IF NOT EXISTS public.shared_links (
  id         UUID PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('watchlist', 'research', 'portfolio')),
  payload    JSONB NOT NULL,
  owner_id   UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shared_links_payload_size CHECK (pg_column_size(payload) < 65536)
);

ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners create share links" ON public.shared_links
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners delete share links" ON public.shared_links
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_shared_link(p_id UUID, p_kind TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('kind', kind, 'payload', payload, 'createdAt', created_at)
  FROM public.shared_links WHERE id = p_id AND kind = p_kind
$$;

REVOKE ALL ON FUNCTION public.get_shared_link(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_link(UUID, TEXT) TO anon, authenticated;
