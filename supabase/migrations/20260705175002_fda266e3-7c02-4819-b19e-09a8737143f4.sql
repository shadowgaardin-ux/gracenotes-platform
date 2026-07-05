ALTER TABLE public.sermons ADD COLUMN IF NOT EXISTS primary_topic text;
CREATE INDEX IF NOT EXISTS sermons_primary_topic_idx ON public.sermons (primary_topic);