---
name: index
description: Project memory index
---
# Project Memory

## Core
- UI language and content strictly Ukrainian.
- Theme: MIA (Orange/White). Dark mode: Slate-900 with neon accents for active events.
- Supabase Auth + RLS: Global read for auth users, create/edit/delete restricted to author only.
- Stack: Lovable Cloud, Supabase (Realtime), Zustand, d3-geo (Ukraine map).
- DB Enums: Store `status` & `severity` in English (Ongoing, Critical). Use protective fallbacks and `safeDate` utility.
- Constraints: Incident Title <= 200 chars, Description <= 2000 chars. Enum strict matching.
- **Unified numbers**: Дашборд / Ситуаційний центр / Календар використовують `useUnifiedStats` як єдине джерело цифр.

## Memories
- [Visual Identity](mem://style/visual-identity) — MIA theme (orange/white), Slate-900 dark mode, neon accents for events
- [Navigation Layout](mem://navigation/layout) — Sidebar with Dashboard, Situation Center, Calendar, Reports, Settings
- [Authentication Flow](mem://features/auth-system) — Supabase Auth on main page with required email confirmation
- [User Profiles](mem://features/profiles) — Schema includes full name, position, rank, and department
- [Data Security & RLS](mem://tech/data-security) — Global read access, create/edit/delete restricted to incident author
- [Data Conventions & Safety](mem://tech/data-conventions) — English enums for status/severity, fallback values, safeDate utility
- [Data Validation](mem://features/data-validation) — Title <= 200 chars, Description <= 2000 chars, enum strict checks
- [State Management](mem://tech/state-management) — Zustand for unified state (incidents, filters) across map, list, and stats
- [Backend & Database](mem://tech/backend) — Lovable Cloud, Supabase Realtime, seeded with 10 test incidents
- [Dashboard UI & Analytics](mem://features/dashboards) — Single-page KPI dashboard, real-time pulse animations, service overlays
- [Situation Center](mem://features/situation-center) — Map marker sync, search, clustering, UTC+2 clock, Ctrl+Shift+P PDF export
- [Map Engine (d3-geo)](mem://tech/map-engine) — d3-geo Ukraine map, scale 3600, 8x zoom, inverse scaling for markers
- [Event Calendar](mem://features/calendar) — Historic/planning view, specific metrics per service, DB incident integration
- [PDF Reports](mem://features/reports) — Auto-paginated A4 reports using Roboto font for Cyrillic, active tab snapshots
- [Incident Audit & Details](mem://features/incident-audit) — Audit trail (who/when), exact address, service category, special equipment
- [Resource Deficit Management](mem://features/resource-management) — Severity-based norms, >30% deficit alerts (audio+toast), clickable regions
- [Unified Stats](mem://tech/unified-stats) — useUnifiedStats — єдине джерело цифр для Dashboard/Situation/Calendar; авто-зведення інцидентів у календарі
