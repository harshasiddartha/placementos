-- Catalog of onboarding questions (edit rows in Supabase to add/change questions; set active = false to hide)
CREATE TABLE "public"."onboarding_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "order_in_step" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_questions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "onboarding_questions_key_key" UNIQUE ("key")
);

CREATE INDEX "onboarding_questions_active_step_idx"
  ON "public"."onboarding_questions" ("active", "step_index", "order_in_step");

DROP TRIGGER IF EXISTS onboarding_questions_set_updated_at ON public.onboarding_questions;
CREATE TRIGGER onboarding_questions_set_updated_at
  BEFORE UPDATE ON public.onboarding_questions
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_profiles_updated_at();

ALTER TABLE public.onboarding_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_questions_select_active" ON public.onboarding_questions;
CREATE POLICY "onboarding_questions_select_active"
  ON public.onboarding_questions FOR SELECT
  TO authenticated
  USING (active = true);

-- Flexible answers blob (keys match onboarding_questions.key)
ALTER TABLE "public"."onboarding_responses"
  ADD COLUMN IF NOT EXISTS "answers" JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE "public"."onboarding_responses"
SET "answers" = jsonb_strip_nulls(
  jsonb_build_object(
    'display_name', to_jsonb("display_name"),
    'academic_year', to_jsonb("academic_year"),
    'goal', to_jsonb("goal"),
    'timeline', to_jsonb("timeline"),
    'skills', COALESCE("skills", '{}'::jsonb),
    'notes', to_jsonb("notes"),
    'track', COALESCE(to_jsonb("track"), '"swe_sde"'::jsonb)
  )
);

ALTER TABLE "public"."onboarding_responses" DROP COLUMN IF EXISTS "display_name";
ALTER TABLE "public"."onboarding_responses" DROP COLUMN IF EXISTS "academic_year";
ALTER TABLE "public"."onboarding_responses" DROP COLUMN IF EXISTS "goal";
ALTER TABLE "public"."onboarding_responses" DROP COLUMN IF EXISTS "timeline";
ALTER TABLE "public"."onboarding_responses" DROP COLUMN IF EXISTS "skills";
ALTER TABLE "public"."onboarding_responses" DROP COLUMN IF EXISTS "notes";
ALTER TABLE "public"."onboarding_responses" DROP COLUMN IF EXISTS "track";

-- Seed default SWE/SDE flow (add rows or UPDATE via Supabase; ON CONFLICT skips re-seed)
INSERT INTO "public"."onboarding_questions"
  ("key", "step_index", "order_in_step", "type", "title", "description", "config", "required", "active")
VALUES
  (
    'display_name',
    0,
    0,
    'short_text',
    'Let''s start with you',
    'We''ll tailor prep for software engineering and SDE interviews.',
    '{"fieldLabel":"What should we call you?","placeholder":"Your name","minLength":2,"maxLength":200}'::jsonb,
    true,
    true
  ),
  (
    'academic_year',
    1,
    0,
    'radio',
    'Where are you academically?',
    'Helps us set pace and depth for DSA, LLD, HLD, and CS core.',
    '{"options":[
      {"value":"year_1","label":"1st year"},
      {"value":"year_2","label":"2nd year"},
      {"value":"year_3","label":"3rd year"},
      {"value":"year_4","label":"4th year / final year"},
      {"value":"masters","label":"Masters / PG"},
      {"value":"graduated","label":"Graduated / working"},
      {"value":"other","label":"Other"}
    ]}'::jsonb,
    true,
    true
  ),
  (
    'goal',
    2,
    0,
    'radio',
    'What are you preparing for?',
    'Pick the closest match — you can refine this later.',
    '{"options":[
      {"value":"internship","label":"Internship","description":"Summer or off-cycle SWE intern roles"},
      {"value":"new_grad_ft","label":"New grad — full-time","description":"Campus placement, SDE I / new grad"},
      {"value":"job_switch","label":"Experienced hire","description":"Switching companies, lateral SDE"},
      {"value":"fundamentals","label":"Stronger fundamentals","description":"No fixed interview date"},
      {"value":"exploring","label":"Exploring","description":"Still deciding target and timeline"}
    ]}'::jsonb,
    true,
    true
  ),
  (
    'timeline',
    2,
    1,
    'radio',
    'Rough timeline to interviews',
    NULL,
    '{"options":[
      {"value":"lt_1m","label":"Under 1 month"},
      {"value":"1_3m","label":"1–3 months"},
      {"value":"3_6m","label":"3–6 months"},
      {"value":"gt_6m","label":"6+ months"}
    ]}'::jsonb,
    true,
    true
  ),
  (
    'skills',
    3,
    0,
    'skill_sliders',
    'Honest skill check',
    '1 = beginner · 5 = interview-ready for typical SDE bar.',
    '{"min":1,"max":5,"sliders":[
      {"key":"dsa","title":"Data structures & algorithms","description":"Problem solving, patterns, complexity"},
      {"key":"lld","title":"Low-level design (LLD)","description":"OOP, classes, APIs, modular design"},
      {"key":"hld","title":"High-level design (HLD)","description":"Distributed systems, scaling, tradeoffs"},
      {"key":"os","title":"Operating systems","description":"Processes, memory, scheduling, sync"},
      {"key":"cn","title":"Computer networks","description":"TCP/IP, HTTP, DNS, basics"},
      {"key":"dbms","title":"DBMS","description":"SQL, transactions, indexing, normalization"}
    ]}'::jsonb,
    true,
    true
  ),
  (
    'notes',
    3,
    1,
    'textarea',
    'Anything else we should know?',
    NULL,
    '{"placeholder":"e.g. target companies, languages you use, contests…","maxLength":5000,"rows":3}'::jsonb,
    false,
    true
  )
ON CONFLICT ("key") DO NOTHING;
