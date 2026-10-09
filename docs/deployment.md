# Развёртывание

- Репозиторий: https://github.com/gsxr-777/selection-auto-parts, ветка main.
- Vercel: команда gsxr-777s-projects, проект selection-auto-parts, root apps/web.
- Production: https://selection-auto-parts.vercel.app.
- Node 24.x, pnpm 10.34.5; build: `pnpm build` внутри apps/web.
- Next.js catch-all передаёт запросы в общий Fastify через inject, без сетевого прокси.
- PostgreSQL: отдельная база и роль selection_auto_parts локально и на существующем
  Neon cluster. Данные cooking_recipe/neondb не копируются. Учётные данные находятся
  только в ignored .env / .env.production.local и Vercel production environment.
- DATABASE_URL: pooled URL для API. DATABASE_URL_UNPOOLED: прямое соединение для
  миграций/импорта. NEXT_PUBLIC_SITE_URL: production origin для metadata.
- В preview нет доступа к production БД: health/database вернёт 503 до настройки
  отдельной preview БД. Пустой каталог и интерфейс работают без подключения.
- `/api/v1/health` проверяет API; `/api/v1/health/database` выполняет SELECT 1,
  отдавая только ok или DATABASE_UNAVAILABLE. Не раскрывает URL/ошибки драйвера.
- `/api/v1/vehicles/selection` читает марки/модели/фасеты/модификации из PostgreSQL;
  `/vehicles/models` требует makeId или ids и возвращает ограниченный список.
  `/parts/categories` принимает точный variantId, `/parts/by-vehicle` — variantId,
  categoryId, page и limit (максимум 50). Некорректные параметры возвращают 400.
  `/parts/references` принимает partId, kind=oe|crosses, page и limit (максимум 100).
  Основная выдача запчастей содержит первые 20 ссылок каждого вида и их полные
  количества oeTotal/crossesTotal. Крупные OE-списки не загружаются целиком в браузер.
- Ограничение запросов Fastify — 60/минуту на процесс/IP; для масштабируемого
  production поиска нужен общий limiter на этапе hardening.
  Bridge принимает client IP из x-forwarded-for только на Vercel, где заголовок
  перезаписывает edge: https://vercel.com/docs/headers/request-headers.

Первая публикация не запускала миграции/seed. Миграция каталога применяется отдельным
шагом через `pnpm db:migrate` локально и `node scripts/migrate-production.cjs`
в облаке с ignored `.env.production.local`. Изменения миграций
проверять на отдельной БД перед production. Не открывать локальную ВМ в интернет.

При ручной публикации: `vercel link --project selection-auto-parts --scope
gsxr-777s-projects`, затем `vercel --prod`. CLI запускать из корня workspace;
rootDirectory задаётся в настройках проекта. GitHub integration должна использовать main.

Избранное не содержит серверных данных/секретов. Перенос на другой домен не переносит
localStorage автоматически. Версия контракта и ключа задокументирована в AGENTS.md.

Импорт и источник — `docs/catalog-import.md`; результат — `scripts/verify-catalog.cjs`.
Проверка публикации: `node scripts/verify-deployment.cjs`.
