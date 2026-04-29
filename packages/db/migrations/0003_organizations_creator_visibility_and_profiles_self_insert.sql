-- =============================================================================
-- Speclyy DB — RLS fixes uncovered by the onboarding flow's first dry run
-- Target project: `speclyy` (Supabase) — single project per ADR-0021
-- =============================================================================
--
-- Two issues, both surfaced once 0002 unblocked organization_members reads:
--
-- 1) organizations INSERT-with-RETURNING failed:
--    `ERROR: new row violates row-level security policy for table "organizations"`
--    The studio Server Action does
--      .from('organizations').insert({...}).select('id').single()
--    which makes PostgREST send `Prefer: return=representation` →
--    INSERT … RETURNING. Postgres requires the RETURNING row to satisfy
--    SELECT USING (in addition to INSERT WITH CHECK). The original
--    `organizations: member read` policy required the row to already be in
--    organization_members — but membership is inserted in the *next*
--    statement. Chicken-and-egg.
--
--    Fix: add a `created_by uuid` column with DEFAULT auth.uid(). Every
--    authenticated insert now stamps the creator's UUID transparently.
--    The SELECT policy gains an `OR created_by = auth.uid()` branch so
--    the just-inserted row passes SELECT USING via the creator branch.
--    Existing members still see their org through the membership subquery,
--    which is recursion-safe after 0002.
--
-- 2) profiles INSERT denied:
--    `ERROR: new row violates row-level security policy for table "profiles"`
--    apps/web/src/app/(onboarding)/_lib/ensure-profile.ts upserts the
--    caller's profile row defensively (self-heal if the auth.users trigger
--    didn't fire, e.g. in tests where rows get wiped). With no INSERT policy
--    on profiles, RLS denied every upsert before ON CONFLICT DO NOTHING
--    could no-op it. Adding `profiles: self insert (id = auth.uid())` makes
--    the helper work; in production the trigger still creates the row first
--    and the upsert is a no-op via ignoreDuplicates.
-- =============================================================================

BEGIN;

-- ---------- organizations.created_by ----------
-- Nullable + ON DELETE SET NULL so we don't lose the org if the creator's
-- auth.users row is later deleted; existing members keep working. The
-- DEFAULT auth.uid() reads the JWT claim of the inserting role, so PostgREST
-- inserts from authenticated clients fill it transparently.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS created_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL
    DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS organizations_created_by_idx
  ON public.organizations (created_by);

DROP POLICY IF EXISTS "organizations: member read" ON public.organizations;
CREATE POLICY "organizations: member read" ON public.organizations
  FOR SELECT USING (
    created_by = auth.uid()
    OR id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ---------- profiles self-insert ----------
DROP POLICY IF EXISTS "profiles: self insert" ON public.profiles;
CREATE POLICY "profiles: self insert" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

COMMIT;
