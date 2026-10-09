# Selection Auto Parts

Начальный этап: развёртывание и пустая база данных. Модели/запчасти не импортированы.

Архитектура повторяет `cooking-recipe`: pnpm workspace, `apps/web` (Next.js 16),
`apps/api` (Fastify), `packages/catalog-core` (Zod DTO и домен), `packages/db`
(Prisma 7 / PostgreSQL). На Vercel API обслуживается через Next.js `/api/v1/[...path]`;
самостоятельный сервер нужен только локально. Не требуется отдельный API-хостинг.

Node 24.20.0, pnpm 10.34.5. Все зависимости закреплены в lockfile.

```powershell
pnpm install --frozen-lockfile
# Создать .env из .env.example и настроить собственную пустую PostgreSQL БД
pnpm db:generate
pnpm dev
```

Сайт: localhost:3000; отдельный API: localhost:3002. Web получает локальный
DATABASE_URL из корневого `.env` через next.config.ts. Prisma CLI также читает `.env`.
В production используются только переменные Vercel.

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter web exec playwright install chromium
pnpm test:e2e
```

Серый глассморфизм, `/ru` (по умолчанию) и `/en`, сохранение темы cookie,
системная тема при первом посещении. Избранные ID моделей сохраняются в localStorage
`selection-auto-parts:favorite-models:v1`. До импорта реальных моделей добавлять нечего;
список честно показывает пустое состояние. Сохранённые недоступные модели можно удалить.
Избранное доступно только на том же origin в этом браузере, без синхронизации аккаунта.

Схема содержит только инфраструктурную модель CatalogSource для генерации Prisma.
Она **не мигрирована**: текущие БД действительно пустые (0 таблиц). Схема автомобилей,
миграции и импортер появятся после исследования реального источника и условий использования.
`db:migrate` — подготовленная команда для будущих проверенных миграций, не seed.

Развёртывание и источник: [docs/deployment.md](docs/deployment.md),
[docs/tecdok-reconnaissance.md](docs/tecdok-reconnaissance.md).

Добавление языка: расширить `packages/catalog-core` locales, `src/i18n/routing.ts`,
добавить `apps/web/messages/<locale>/common.json`, включить словарь в тест полноты,
обновить canonical/hreflang и E2E маршруты, проверить перевод с редактором. Идентификаторы
моделей и localStorage не переводятся; компоненты получают текст через next-intl.
