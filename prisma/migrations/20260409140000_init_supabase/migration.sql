-- PrepMind: Supabase Postgres + pgvector + RLS (applied via Prisma Migrate → same DB as Supabase Auth)

CREATE EXTENSION IF NOT EXISTS vector;

-- Profiles: one row per auth user
CREATE TABLE "public"."profiles" (
    "id" UUID NOT NULL,
    "display_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES auth.users (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_profiles_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    NULLIF(TRIM(COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      SPLIT_PART(COALESCE(NEW.email, 'user'), '@', 1)
    )), '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

CREATE TABLE "public"."document_embeddings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(1536),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_embeddings_user_id_idx" ON "document_embeddings"("user_id");

CREATE INDEX "document_embeddings_embedding_hnsw"
  ON "document_embeddings"
  USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "document_embeddings"
  ADD CONSTRAINT "document_embeddings_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_embeddings_select_own" ON public.document_embeddings;
CREATE POLICY "document_embeddings_select_own"
  ON public.document_embeddings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "document_embeddings_insert_own" ON public.document_embeddings;
CREATE POLICY "document_embeddings_insert_own"
  ON public.document_embeddings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "document_embeddings_update_own" ON public.document_embeddings;
CREATE POLICY "document_embeddings_update_own"
  ON public.document_embeddings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "document_embeddings_delete_own" ON public.document_embeddings;
CREATE POLICY "document_embeddings_delete_own"
  ON public.document_embeddings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
