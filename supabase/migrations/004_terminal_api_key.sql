-- Migration 004: retired (5 Nov 2026). Nothing to apply.
--
-- It added profiles.api_key for the Terminal API. The API is retired
-- (api/terminal-api.js answers 410 Gone), so this file now does nothing.
-- Production already has the column (seen 5 Nov by a read-only probe; it
-- was missing on 27 Oct): nothing reads or writes it, and it can be dropped
-- later (drop column api_key from public.profiles).
-- The file stays so the numbering of later migrations is unchanged.

SELECT 1;
