
-- Add new columns to incidents table for full situation center data
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS coordinates_lng double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coordinates_lat double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS region_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS region_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS severity text DEFAULT 'Major',
  ADD COLUMN IF NOT EXISTS lead_agency text DEFAULT 'ДСНС',
  ADD COLUMN IF NOT EXISTS ses_units integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS police_units integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medical_units integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS personnel_total integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rescued integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS injured integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fatalities integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damage_est text DEFAULT '',
  ADD COLUMN IF NOT EXISTS damage_uah numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_resolution_time timestamptz DEFAULT (now() + interval '3 hours'),
  ADD COLUMN IF NOT EXISTS risk_level integer DEFAULT 5;

-- Drop restrictive RLS policies and replace with shared read access
DROP POLICY IF EXISTS "Users can view own incidents" ON public.incidents;
CREATE POLICY "Authenticated users can view all incidents"
  ON public.incidents FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own incidents" ON public.incidents;
CREATE POLICY "Authenticated users can insert incidents"
  ON public.incidents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own incidents" ON public.incidents;
CREATE POLICY "Authenticated users can update own incidents"
  ON public.incidents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own incidents" ON public.incidents;
CREATE POLICY "Authenticated users can delete own incidents"
  ON public.incidents FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
