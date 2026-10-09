# Фаза 0A — 09.10.2026

Исходное состояние: только AGENTS.md, локального Git не было; удалённый репозиторий
пустой. cooking-recipe: pnpm 10.34.5, Node 24.20, Next.js 16.3.6, React 19.2.8,
next-intl 4.14.7, Fastify 5.12.5, Prisma 7.10, PostgreSQL 18 локально и Neon на Vercel.
Эта архитектура перенесена без данных предметной области и без копирования секретов
в репозиторий. Transitive SWC закреплён на 1.16.2 из reference lockfile: более новая
1.16.13 не загружала native binding на этой Windows-системе.

Созданы отдельные локальная и облачная базы/роли selection_auto_parts: 0 таблиц,
без seed, миграций и автомобилей. На существующем Neon cluster создана отдельная БД,
не новый платный provider project. Учётные данные нового пользователя в ignored env
и encrypted production environment Vercel. Preview не получает production credentials.

Обновлён AGENTS.md: deploy-first фаза, workspace/API архитектура, источник из ВМ,
глассморфизм и версия localStorage избранного. Созданы workspace/package configs,
apps/web, apps/api, packages/catalog-core, packages/db, CI, документация и команды
проверки БД/публикации. UI: RU/EN, тема, серое стекло, честный пустой каталог.

Фактически выполнены и прошли:

- `pnpm install` и `pnpm db:generate`.
- `pnpm lint` — без предупреждений после исправления PostCSS export.
- `pnpm typecheck` — все workspace пакеты; Next build также проверяет TypeScript.
- `pnpm test` — 8 unit/API тестов: избранное, fallback, ключи RU/EN, пустой каталог,
  валидация, недоступная БД, limiter.
- `pnpm build` — production сборка Next.js.
- `pnpm --filter web exec playwright install chromium` и `pnpm test:e2e` — 3 E2E:
  RU/EN/query state, тема/reload, favorites/reload/locale/tabs, повреждённый и запрещённый
  localStorage, мобильная ширина. Модели в тестах подменяются только перехватом API;
  ни одна fixture не записывается в production БД.
- `node scripts/verify-databases.cjs` — обе БД, отдельная роль, 0 таблиц.
- `node scripts/verify-deployment.cjs` — root → /ru; /ru, /en и все начальные API HTTP 200;
  health/database возвращает ok, models возвращает empty.
- `vercel --prod --yes --scope gsxr-777s-projects` — production READY и домен
  https://selection-auto-parts.vercel.app.
- Скриншоты опубликованного сайта просмотрены в light/dark и при ширине 390 px.
- VBoxManage runningvms/showvminfo/guestproperty подтвердили запущенную TecDok.
  guestcontrol без пароля для gsx отклонён гостевой ОС.

Следующий этап: доступ к гостевому экспорту, версия/формат и разрешённое использование
TecDoc; затем schema, sample import и зависимые фильтры. Добавление реальных моделей
в избранное станет доступно после импорта. Поиск, VIN и fitment пока запланированы,
не представлены работающими контролами.
