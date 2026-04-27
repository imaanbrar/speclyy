-- =============================================================================
-- Speclyy DB — fix infinite recursion in organization_members SELECT policy
-- Target project: `speclyy` (Supabase) — single project per ADR-0021
-- =============================================================================
--
-- The "self read" policy in 0001_initial_schema.sql referenced
-- organization_members in its own subquery:
--
--   USING (
--     user_id = auth.uid()
--     OR organization_id IN (
--       SELECT organization_id FROM public.organization_members
--       WHERE user_id = auth.uid()
--     )
--   )
--
-- Postgres re-evaluates the same policy on the inner SELECT, causing infinite
-- recursion. Every read against organization_members failed with:
--   ERROR: infinite recursion detected in policy for relation "organization_members"
--
-- Symptom: the studio onboarding Server Action (apps/web/src/app/(onboarding)/
-- onboarding/studio/actions.ts) errored on `findExistingOrgId()` before it
-- could insert/update anything.
--
-- v1 fix: reads are restricted to the caller's own membership rows. Every
-- onboarded user has exactly one row right now, so this is functionally
-- complete. The "see other members of my org" branch was forward-compat for
-- teammate invites — when those ship, the recursion-safe pattern is a
-- SECURITY DEFINER helper (e.g. `public.is_org_member(uuid)`) that bypasses
-- RLS internally, NOT an inline self-referencing subquery.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS "organization_members: self read" ON public.organization_members;
CREATE POLICY "organization_members: self read" ON public.organization_members
  FOR SELECT USING (user_id = auth.uid());

COMMIT;
