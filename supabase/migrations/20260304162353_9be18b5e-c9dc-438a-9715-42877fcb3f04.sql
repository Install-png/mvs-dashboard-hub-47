
-- Add new columns to incidents table
ALTER TABLE public.incidents 
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'SES',
  ADD COLUMN IF NOT EXISTS address text DEFAULT '',
  ADD COLUMN IF NOT EXISTS specialized_equipment text[] DEFAULT '{}';

-- Create incident audit log table
CREATE TABLE IF NOT EXISTS public.incident_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL DEFAULT 'update',
  changes jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.incident_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can view audit logs
CREATE POLICY "Authenticated users can view audit logs"
  ON public.incident_audit_log FOR SELECT TO authenticated
  USING (true);

-- RLS: authenticated users can insert audit logs
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.incident_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Update existing data: map category from lead_agency
UPDATE public.incidents SET category = 
  CASE 
    WHEN lead_agency ILIKE '%ДСНС%' THEN 'SES'
    WHEN lead_agency ILIKE '%Полі%' THEN 'Police'
    WHEN lead_agency ILIKE '%Мед%' THEN 'Medical'
    ELSE 'SES'
  END
WHERE category IS NULL OR category = 'SES';

-- Enable realtime for audit log
ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_audit_log;
