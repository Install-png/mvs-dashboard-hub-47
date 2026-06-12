CREATE TABLE public.resource_status_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT NOT NULL DEFAULT '',
  to_status TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.resource_status_log TO authenticated;
GRANT ALL ON public.resource_status_log TO service_role;
ALTER TABLE public.resource_status_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view status log" ON public.resource_status_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert status log" ON public.resource_status_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin delete status log" ON public.resource_status_log FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_resource_status_log_resource ON public.resource_status_log(resource_id, created_at DESC);