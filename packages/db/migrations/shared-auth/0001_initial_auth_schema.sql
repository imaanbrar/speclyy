-- =============================================================================
-- Speclyy shared-auth DB — initial schema
-- Target project: speclyy-auth (Supabase)
-- ADR-0019 (multi-app architecture), ADR-0007 (auth data model)
--
-- Apply via: Supabase Dashboard → SQL Editor → paste this file → Run.
-- Greenfield project: no existing data to preserve.
-- =============================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- profiles
-- App-agnostic user record, 1:1 with auth.users. `is_onboarded` is a
-- GENERATED STORED column so middleware can filter cheaply.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  market text,
  onboarding_completed_at timestamptz,
  is_onboarded boolean GENERATED ALWAYS AS (onboarding_completed_at IS NOT NULL) STORED,
  has_visited_dashboard boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profiles_is_onboarded_idx ON public.profiles (is_onboarded);

-- -------------------------------------------------------------------------
-- organizations
-- Account-level entity with a `type` discriminator. No UNIQUE on name.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  type       text NOT NULL CHECK (type IN ('individual','studio','firm','team')),
  size       text CHECK (size IN ('solo','2_5','6_10','11_plus')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organizations_type_idx ON public.organizations (type);

-- -------------------------------------------------------------------------
-- organization_members
-- Profile ↔ organization join with a role.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('owner','admin','member')) DEFAULT 'owner',
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS organization_members_user_id_idx
  ON public.organization_members (user_id);

-- -------------------------------------------------------------------------
-- subscriptions
-- Per-user Stripe state. Free users have NO row. user_id is UNIQUE.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN (
    'active','past_due','canceled','incomplete','incomplete_expired'
  )),
  current_period_end timestamptz,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  promo_code_id uuid,
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions (user_id);

-- -------------------------------------------------------------------------
-- handle_new_user trigger
-- Creates a blank profiles row on auth.users insert. SECURITY DEFINER with
-- an explicit search_path blocks search-path hijacking.
--
-- Organization creation is NOT in this trigger — org type depends on whether
-- the user completes or skips the studio onboarding step, so Server Actions
-- own that write.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: create profile rows for any auth.users that predate the trigger.
-- Safe no-op on a greenfield project; cheap insurance if one user was created
-- manually during provisioning before this migration ran.
INSERT INTO public.profiles (id)
SELECT u.id
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- =============================================================================
-- Row-Level Security
-- auth.uid() is the only user identity the DB trusts.
-- =============================================================================

-- -------- profiles --------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: self read" ON public.profiles;
CREATE POLICY "profiles: self read" ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles: self update" ON public.profiles;
CREATE POLICY "profiles: self update" ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- -------- organizations --------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizations: member read" ON public.organizations;
CREATE POLICY "organizations: member read" ON public.organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "organizations: admin update" ON public.organizations;
CREATE POLICY "organizations: admin update" ON public.organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

-- Any authenticated user may create their first org during onboarding. Pairs
-- with the organization_members self-INSERT policy below: an org is only
-- reachable if the creator also links themselves as a member in the same
-- Server Action.
DROP POLICY IF EXISTS "organizations: authenticated insert" ON public.organizations;
CREATE POLICY "organizations: authenticated insert" ON public.organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- -------- organization_members --------
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organization_members: self read" ON public.organization_members;
CREATE POLICY "organization_members: self read" ON public.organization_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Users insert their own membership rows; no UPDATE/DELETE policy (future
-- invites/removals will use a dedicated RPC).
DROP POLICY IF EXISTS "organization_members: self insert" ON public.organization_members;
CREATE POLICY "organization_members: self insert" ON public.organization_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- -------- subscriptions --------
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions: self read" ON public.subscriptions;
CREATE POLICY "subscriptions: self read" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- No user-facing INSERT/UPDATE/DELETE policies on subscriptions.
-- Stripe webhooks write via the service-role key which bypasses RLS.

COMMIT;
