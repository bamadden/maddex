// The migrations in a real Postgres (PGlite, in process; 26 Nov 2026, Ben's
// approval). Every file in supabase/migrations is applied in order on a
// minimal stand-in for Supabase's auth schema, then supabase/checks/
// 012_verify.sql (the script Ben ran in the SQL Editor) is run exactly as
// written: before 012 it must find the hole, after 012 every line must PASS.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const MIGRATIONS = fs.readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()
const VERIFY = fs.readFileSync('supabase/checks/012_verify.sql', 'utf8')

// What Supabase provides that the migrations rely on: the API roles, the auth
// schema's users table, and auth.uid() / auth.role() read from the request's
// JWT claims (as Supabase's own functions do).
const SUPABASE_STAND_IN = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
`

async function database(upTo = null) {
  const db = new PGlite()
  await db.exec(SUPABASE_STAND_IN)
  for (const f of MIGRATIONS) {
    if (upTo && f > upTo) break
    await db.exec(fs.readFileSync(`supabase/migrations/${f}`, 'utf8'))
  }
  return db
}

// Runs the verification script as written; it always ends by raising its
// result (which also rolls back every test insert).
async function verify(db) {
  try { await db.exec(VERIFY); return null } catch (e) {
    await db.exec('ROLLBACK').catch(() => {})
    return /RESULT: (.*)$/.exec(e.message)?.[1] ?? e.message
  }
}

const rows = async (db) => (await db.query('SELECT count(*)::int AS n FROM public.waitlist')).rows[0].n

test('every migration applies, in order, on a fresh database', async () => {
  const db = await database()
  const { rows: t } = await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")
  for (const name of ['waitlist', 'profiles', 'ai_usage', 'ai_records', 'shared_links']) assert.ok(t.some((r) => r.tablename === name), name)
  await db.close()
})

test('before migration 012 the verification script finds the hole (as it did in production)', async () => {
  const db = await database('011_ai_records.sql')
  const result = await verify(db)
  assert.match(result, /FAIL launch-site accepted/)
  assert.match(result, /FAIL newsletter accepted/)
  assert.match(result, /FAIL back-dated row accepted/)
  assert.match(result, /CHECK row for another account: refused by the foreign key/)
  assert.match(result, /PASS terminal row accepted \(rolled back\)/)
  assert.equal(await rows(db), 0, 'the script rolled everything back')
  await db.close()
})

test('after migration 012 every line of the verification script passes', async () => {
  const db = await database()
  const result = await verify(db)
  assert.equal(result, 'PASS launch-site refused | PASS newsletter refused | PASS back-dated row refused | PASS row for another account refused | PASS terminal row accepted (rolled back)')
  assert.equal(await rows(db), 0, 'the script rolled everything back')
  await db.close()
})

test('after 012 a signed-in user may add a terminal row for their own account only', async () => {
  const db = await database()
  const { rows: [me] } = await db.query("INSERT INTO auth.users (email) VALUES ('me@example.invalid') RETURNING id")
  const { rows: [other] } = await db.query("INSERT INTO auth.users (email) VALUES ('other@example.invalid') RETURNING id")
  const asUser = async (sql, params) => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)", [me.id])
    await db.exec('SET LOCAL ROLE authenticated')
    try { await db.query(sql, params); await db.exec('COMMIT'); return 'ok' } catch (e) { await db.exec('ROLLBACK'); return e.message }
  }
  assert.equal(await asUser("INSERT INTO public.waitlist (email, tier, source, user_id) VALUES ('me@example.invalid', 'apex', 'terminal', $1)", [me.id]), 'ok')
  assert.equal(await asUser("INSERT INTO public.waitlist (email, source) VALUES ('me2@example.invalid', 'terminal')"), 'ok', 'user_id defaults to auth.uid()')
  assert.match(await asUser("INSERT INTO public.waitlist (email, source, user_id) VALUES ('x@example.invalid', 'terminal', $1)", [other.id]), /row-level security/)
  assert.match(await asUser("INSERT INTO public.waitlist (email, source) VALUES ('y@example.invalid', 'newsletter')"), /row-level security/)
  // The service role (what /api/waitlist uses) still writes confirmed rows.
  await db.exec('SET ROLE service_role')
  await db.query("INSERT INTO public.waitlist (email, source) VALUES ('z@example.invalid', 'launch-site')")
  await db.exec('RESET ROLE')
  assert.equal(await rows(db), 3)
  await db.close()
})

test('the public key still cannot read the list', async () => {
  const db = await database()
  await db.query("INSERT INTO public.waitlist (email, source) VALUES ('a@example.invalid', 'launch-site')")
  await db.exec('BEGIN; SET LOCAL ROLE anon')
  const { rows: seen } = await db.query('SELECT * FROM public.waitlist')
  await db.exec('ROLLBACK')
  assert.equal(seen.length, 0)
  await db.close()
})
