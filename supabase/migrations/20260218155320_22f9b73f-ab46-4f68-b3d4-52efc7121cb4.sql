
-- Create calendar_events table with service-specific fields
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  event_time TIME,
  location TEXT DEFAULT '',
  
  -- Involved services (checkboxes)
  service_ses BOOLEAN NOT NULL DEFAULT false,
  service_police BOOLEAN NOT NULL DEFAULT false,
  service_national_guard BOOLEAN NOT NULL DEFAULT false,
  service_other TEXT DEFAULT '',
  
  -- SES-specific fields
  ses_people_rescued INTEGER DEFAULT 0,
  ses_fires_extinguished INTEGER DEFAULT 0,
  ses_equipment_used TEXT DEFAULT '',
  ses_personnel_involved INTEGER DEFAULT 0,
  
  -- Police-specific fields
  police_calls INTEGER DEFAULT 0,
  police_arrests INTEGER DEFAULT 0,
  police_reports_filed INTEGER DEFAULT 0,
  police_patrols_deployed INTEGER DEFAULT 0,
  
  -- National Guard-specific fields
  ng_personnel_deployed INTEGER DEFAULT 0,
  ng_equipment_units INTEGER DEFAULT 0,
  ng_operations_conducted INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar events" ON public.calendar_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own calendar events" ON public.calendar_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own calendar events" ON public.calendar_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own calendar events" ON public.calendar_events FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create reports table
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  report_type TEXT NOT NULL DEFAULT 'daily', -- daily, monthly, yearly
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports" ON public.reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reports" ON public.reports FOR DELETE USING (auth.uid() = user_id);

-- Add service column to existing incidents table
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS service TEXT DEFAULT '';
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';
