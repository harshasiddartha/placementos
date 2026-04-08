-- Per-user onboarding (linked to profiles / auth.users)

CREATE TABLE "public"."onboarding_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "display_name" TEXT,
    "academic_year" TEXT,
    "goal" TEXT,
    "timeline" TEXT,
    "skills" JSONB NOT NULL DEFAULT '{"dsa":3,"lld":3,"hld":3,"os":3,"cn":3,"dbms":3}'::jsonb,
    "notes" TEXT,
    "track" TEXT NOT NULL DEFAULT 'swe_sde',
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "onboarding_responses_user_id_key" ON "public"."onboarding_responses"("user_id");

ALTER TABLE "public"."onboarding_responses"
  ADD CONSTRAINT "onboarding_responses_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DROP TRIGGER IF EXISTS onboarding_responses_set_updated_at ON public.onboarding_responses;
CREATE TRIGGER onboarding_responses_set_updated_at
  BEFORE UPDATE ON public.onboarding_responses
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_profiles_updated_at();

ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_responses_select_own" ON public.onboarding_responses;
CREATE POLICY "onboarding_responses_select_own"
  ON public.onboarding_responses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "onboarding_responses_insert_own" ON public.onboarding_responses;
CREATE POLICY "onboarding_responses_insert_own"
  ON public.onboarding_responses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "onboarding_responses_update_own" ON public.onboarding_responses;
CREATE POLICY "onboarding_responses_update_own"
  ON public.onboarding_responses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "onboarding_responses_delete_own" ON public.onboarding_responses;
CREATE POLICY "onboarding_responses_delete_own"
  ON public.onboarding_responses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
