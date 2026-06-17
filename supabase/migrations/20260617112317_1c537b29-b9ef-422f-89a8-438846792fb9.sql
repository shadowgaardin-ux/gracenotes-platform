
-- Add visibility + audio metadata to sermons
ALTER TABLE public.sermons
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','shared')),
  ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'text' CHECK (source_kind IN ('text','recording','upload','url')),
  ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Replace sermon policies: personal notebooks + opt-in sharing
DROP POLICY IF EXISTS "Org members read sermons" ON public.sermons;
DROP POLICY IF EXISTS "Pastoral insert sermons" ON public.sermons;
DROP POLICY IF EXISTS "Pastoral update sermons" ON public.sermons;
DROP POLICY IF EXISTS "Pastoral delete sermons" ON public.sermons;

CREATE POLICY "Read own or shared sermons" ON public.sermons FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    OR (visibility = 'shared' AND organization_id = public.get_user_org(auth.uid()))
  );
CREATE POLICY "Any member insert own sermon" ON public.sermons FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND organization_id = public.get_user_org(auth.uid())
  );
CREATE POLICY "Author updates own sermon" ON public.sermons FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Author deletes own sermon" ON public.sermons FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- sermon_content follows the parent sermon's visibility/ownership
DROP POLICY IF EXISTS "Org read sermon content" ON public.sermon_content;
DROP POLICY IF EXISTS "Pastoral write sermon content" ON public.sermon_content;

CREATE POLICY "Read content for accessible sermon" ON public.sermon_content FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sermons s
    WHERE s.id = sermon_content.sermon_id
      AND (s.author_id = auth.uid() OR (s.visibility = 'shared' AND s.organization_id = public.get_user_org(auth.uid())))
  ));
CREATE POLICY "Author writes content for own sermon" ON public.sermon_content FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sermons s WHERE s.id = sermon_content.sermon_id AND s.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sermons s WHERE s.id = sermon_content.sermon_id AND s.author_id = auth.uid()));

-- scripture_refs same model
DROP POLICY IF EXISTS "Org read scripture refs" ON public.scripture_refs;
DROP POLICY IF EXISTS "Pastoral write scripture refs" ON public.scripture_refs;

CREATE POLICY "Read refs for accessible sermon" ON public.scripture_refs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sermons s
    WHERE s.id = scripture_refs.sermon_id
      AND (s.author_id = auth.uid() OR (s.visibility = 'shared' AND s.organization_id = public.get_user_org(auth.uid())))
  ));
CREATE POLICY "Author writes refs for own sermon" ON public.scripture_refs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sermons s WHERE s.id = scripture_refs.sermon_id AND s.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sermons s WHERE s.id = scripture_refs.sermon_id AND s.author_id = auth.uid()));
