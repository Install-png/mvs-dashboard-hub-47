---
name: Unified stats system
description: Single source of truth для синхронізації цифр на Дашборді, Сит. центрі та Календарі через useUnifiedStats
type: feature
---
# Уніфікована система статистики

Усі цифри (інциденти, врятовані, поранені, ресурси по службах) рахуються в `src/hooks/useUnifiedStats.tsx` із одного `useIncidentStore`. Компоненти НЕ роблять локальних підрахунків.

## Що дає хук
- `unified.all` — повна агрегація
- `unified.today` / `unified.yesterday` — за день
- `unified.trends` — порівняння today vs yesterday
- `unified.byDate[YYYY-MM-DD]` — за конкретну дату
- `unified.statsForDate(date)` / `statsForRange(from, to)`

Кожен `PeriodStats` містить: total, active, critical, resolved, rescued, injured, fatalities, damage_uah, personnel, units по службах, byService/bySeverity/byType.

## Календар: автоперенос інцидентів
У CalendarPage у правій панелі для вибраного дня показується картка **"Авто-зведення з Сит. центру"** з розподілом по службах та кнопкою "Створити звіт зі зведення" — копіює агреговані цифри в нову подію `calendar_events`.
