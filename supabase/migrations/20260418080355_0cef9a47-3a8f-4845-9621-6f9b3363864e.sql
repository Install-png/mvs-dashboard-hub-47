-- Add archive support and status to calendar events
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_calendar_events_archived ON public.calendar_events(is_archived, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON public.calendar_events(user_id, event_date DESC);

-- Auto-archive function: marks events as archived after their event_date passes
CREATE OR REPLACE FUNCTION public.auto_archive_calendar_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.calendar_events
  SET is_archived = true,
      archived_at = now(),
      status = CASE WHEN status = 'planned' THEN 'completed' ELSE status END
  WHERE is_archived = false
    AND event_date < CURRENT_DATE;
END;
$$;

-- Trigger to auto-archive on read (simple approach: trigger on insert/update validates date)
CREATE OR REPLACE FUNCTION public.set_archive_on_past_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.event_date < CURRENT_DATE AND NEW.is_archived = false THEN
    NEW.is_archived := true;
    NEW.archived_at := COALESCE(NEW.archived_at, now());
    IF NEW.status = 'planned' THEN
      NEW.status := 'completed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calendar_events_auto_archive ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_auto_archive
  BEFORE INSERT OR UPDATE OF event_date ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_archive_on_past_event();

-- Backfill: archive all past events
SELECT public.auto_archive_calendar_events();