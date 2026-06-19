ALTER TABLE public.sermons
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS series text;

CREATE INDEX IF NOT EXISTS sermons_tags_idx ON public.sermons USING gin (tags);
CREATE INDEX IF NOT EXISTS sermons_series_idx ON public.sermons (series);
CREATE INDEX IF NOT EXISTS sermons_search_idx ON public.sermons
  USING gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(scripture_focus,'') || ' ' || coalesce(transcript,'')));