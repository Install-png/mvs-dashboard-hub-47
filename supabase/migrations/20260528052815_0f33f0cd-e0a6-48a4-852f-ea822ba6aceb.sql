
-- ── UNITS ──
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  service text NOT NULL,
  region_id text NOT NULL DEFAULT '',
  region_name text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  lat double precision NOT NULL DEFAULT 0,
  lng double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view units" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert units" ON public.units FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update units" ON public.units FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete units" ON public.units FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ── RESOURCES ──
CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  type text NOT NULL,
  label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'available',
  is_reserve boolean NOT NULL DEFAULT false,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resources TO authenticated;
GRANT ALL ON public.resources TO service_role;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view resources" ON public.resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert resources" ON public.resources FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update resources" ON public.resources FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete resources" ON public.resources FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ── DISPATCHES ──
CREATE TABLE public.resource_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  eta_minutes integer NOT NULL DEFAULT 0,
  distance_km double precision NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'en_route',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_dispatches TO authenticated;
GRANT ALL ON public.resource_dispatches TO service_role;
ALTER TABLE public.resource_dispatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view dispatches" ON public.resource_dispatches FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert dispatches" ON public.resource_dispatches FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth update own dispatches" ON public.resource_dispatches FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete dispatches" ON public.resource_dispatches FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ── ADMIN ASSIGNMENTS ──
CREATE TABLE public.admin_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  region_id text NOT NULL DEFAULT '',
  region_name text NOT NULL DEFAULT '',
  service text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid,
  UNIQUE (user_id, region_id, service)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_assignments TO authenticated;
GRANT ALL ON public.admin_assignments TO service_role;
ALTER TABLE public.admin_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin view all assignments" ON public.admin_assignments FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR auth.uid() = user_id);
CREATE POLICY "admin insert assignments" ON public.admin_assignments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete assignments" ON public.admin_assignments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ── NOTIFICATIONS ──
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  incident_id uuid,
  kind text NOT NULL DEFAULT 'incident',
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT 'in_app',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "service insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE TRIGGER trg_units_updated BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_resources_updated BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
