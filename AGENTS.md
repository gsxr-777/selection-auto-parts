# AGENTS.md — Multilingual Automotive Parts Catalog

## 1. Project objective
Build a responsive automotive parts catalog inspired by TecDoc workflows. Users must be able to:
- Select a vehicle through dependent hierarchical filters.
- Search parts by name, manufacturer part number, or OE number.
- Identify a vehicle using VIN through a configured data provider, then browse compatible parts.
- View part details, confirmed cross-references, OE references, attributes, and vehicle fitment.
- Switch between light and dark grayscale themes.
- Use the application in Russian and English from the first release, with architecture ready for additional languages.

A future mobile application should reuse the same backend API and domain contracts. Do not build the native app in the MVP.

## 2. Non-negotiable engineering rules
1. Inspect the existing repository before changing files. Preserve working conventions and report the detected stack.
2. Do not invent catalog data, VIN decoding results, fitment, cross-references, prices, stock, or source licensing rights.
3. Keep source attribution and import provenance internally. On 2026-10-09 the project owner confirmed permission to extract the installed TecDoc catalog and publish its data, authorizing the import. Record this as the owner's confirmation, not an independent contract review. Remove TecDoc mentions from the application interface; never remove internal provenance.
4. All UI strings must be localized. No hard-coded user-facing strings in components, validation messages, metadata, or navigation.
5. Russian (`ru`) and English (`en`) are required at launch. Adding a locale must not require rewriting components or database schema.
6. Keep internal IDs and catalog identifiers language-neutral. Localize labels separately from stable identifiers.
7. VIN requests and provider credentials must be handled server-side. Never expose API secrets to the browser.
8. Do not claim a part is compatible unless supported by imported catalog fitment or a clearly identified provider result.
9. Validate all input at API boundaries; use parameterized database access; rate-limit public search and VIN endpoints.
10. Implement work in small phases. Run lint, typecheck, and relevant tests after each phase; do not claim checks passed unless actually run.
11. Follow the inspected cooking-recipe pnpm monorepo: apps/web (Next.js), apps/api (shared Fastify API), packages/catalog-core (DTOs/domain), packages/db (Prisma). On Vercel, host the API through a Next.js catch-all bridge; standalone Fastify is for local development/future clients. This is one deployable application, not microservices.
12. Do not add Elasticsearch until PostgreSQL search is measured and found insufficient.

## 3. Confirmed architecture and deployment
- Reference: `C:/1/777/laravel/cooking-recipe`; copy architecture and deployment conventions, never its domain data or secrets.
- GitHub: https://github.com/gsxr-777/selection-auto-parts, production branch `main`.
- Vercel team: `gsxr-777s-projects`; project: `selection-auto-parts`; domain: `selection-auto-parts.vercel.app`; root directory: `apps/web`; Node.js 24, pnpm 10.34.5.
- Next.js 16.3.6, React 19.2.8, next-intl 4.14.7, Fastify 5.12.5, Prisma 7.10.0. Pin compatible dependency versions.
- Local PostgreSQL 18 and a separate cloud PostgreSQL database/role `selection_auto_parts` on the existing Neon cluster. Do not reuse the cooking database or credentials in deployments.
- Provision empty databases first. No seed/import or speculative vehicle schema during infrastructure deployment.
- API contracts start at `/api/v1`; the route map below is a future feature map under that prefix.
- Reuse the cooking-recipe theme/language switch visual conventions, adapted to locale-prefixed routing and complete dictionaries.

### Libraries
- Next.js App Router, current stable version compatible with the repository.
- TypeScript with strict mode.
- Tailwind CSS with CSS-variable-based semantic design tokens.
- PostgreSQL.
- Prisma ORM (unless an existing project already uses a different suitable ORM).
- Zod for request and environment validation.
- React Hook Form only for forms that need it.
- TanStack Query where client-side server-state caching materially helps; do not add it by default if Server Components and simple fetches suffice.
- next-intl (preferred) for route-based internationalization. If the repository already uses a maintained i18n library, retain it unless there is a compelling technical reason to migrate.
- Vitest for unit/integration tests and Playwright for key end-to-end flows.
- ESLint and the repository's existing formatter.

Pin compatible dependency versions and follow the repository lockfile. Do not upgrade unrelated packages without reason.

## 4. Internationalization requirements
### Launch locales
- `ru`: Russian, default locale initially.
- `en`: English.

### Routing and locale behavior
- Use locale-prefixed routes, for example `/ru`, `/en`, `/ru/catalog/...`, `/en/catalog/...`.
- Redirect the bare root `/` to the configured default locale. Do not rely only on browser language to make routing deterministic.
- Provide a visible language switcher in the shared header. Switching language should preserve the current page and relevant vehicle/search state when a translated route exists.
- Persist the user's chosen locale using a cookie or the i18n library's supported mechanism. Respect an explicit URL locale.
- Generate canonical and `hreflang` metadata for equivalent localized pages where appropriate.
- Localize page titles, descriptions, Open Graph metadata, navigation, form labels, placeholders, empty states, errors, accessibility labels, breadcrumbs, pagination, and date/number formatting.
- Use locale-aware formatting APIs for dates and numbers. Store timestamps in UTC and store quantities in canonical numeric units.
- Use Unicode/UTF-8 throughout. Do not translate catalog codes, OE numbers, part numbers, VINs, engine codes, or stable slugs.
- Avoid concatenating sentence fragments. Use complete translation messages and named interpolation variables.
- Keep translation dictionaries organized by feature, for example `messages/ru/common.json`, `messages/ru/search.json`, `messages/en/common.json`, `messages/en/search.json`.
- Add a test that detects missing translation keys in either launch locale. Missing translations must be visible during development/CI, not silently rendered as keys in production.
- Add a documented procedure for introducing a new locale: locale config, dictionaries, metadata, tests, and translation review.

### Localized catalog data
Catalog source names may be available in only one language. Design for localized labels without duplicating core entities:
- Store stable source identifiers and language-neutral relations in core tables.
- For names/descriptions that require translations, use a translation table keyed by entity ID and locale, or a consistent JSON/translation-table approach selected after inspecting the source data.
- Keep original source text and source language where appropriate.
- Define a deterministic fallback chain: requested locale → configured default locale → original source label. Mark fallback content internally where useful; do not pretend fallback text was translated.
- Do not store translations by making duplicate vehicle/part rows per language.

## 5. UX and visual design
- Grayscale glassmorphism: translucent panels, backdrop blur, subtle highlights and shadows. Use semantic CSS variables for backgrounds, surfaces, borders, primary/secondary text, focus rings, disabled controls, and overlays; check readability in both themes.
- Light and dark themes must both be complete and readable. Use system preference on first visit, then persist explicit user selection.
- Avoid hard-coded colors in individual components; use theme tokens and Tailwind utilities mapped to tokens.
- Meet WCAG AA contrast where practical; provide visible keyboard focus and accessible labels.
- Responsive layouts: desktop filters may be inline/sidebar; mobile filters use a compact stacked layout or accessible drawer/bottom sheet.
- Vehicle selectors are dependent searchable selects. Changing a parent resets all descendant selections.
- Preserve selected vehicle/search state in shareable URLs when appropriate.
- Provide loading, empty, error, partial-data, and no-fitment states.
- Do not make decorative prototype controls appear functional. Every visible control must work or be clearly marked as unavailable in development.
- Avoid adding arbitrary stock photos as catalog data. Product imagery must be linked to an identified source record.

## 6. Main user flows
1. Home page: three modes — select vehicle, search by part name/number, search by VIN.
2. Vehicle selection: make → model → generation/series → production range/year → body → engine → modification/variant, only showing dimensions supported by the data source.
3. Parts category browsing for the selected vehicle.
4. Search results with filters, sorting, pagination, and exact-match priority for part/OE numbers.
5. Part detail page: brand, part number, title, category, attributes, OE references, cross-references, source/provenance, and fitment.
6. VIN lookup: format validation → provider request → display decoded attributes and confidence/source → user confirmation or manual correction → fitment results.
7. Locale switching while preserving route and compatible query parameters.
8. Theme switching and persistence.
9. Save/remove favorite vehicle models locally, restore them after reload, preserve them across RU/EN, and synchronize browser tabs.

## 7. Suggested route map
- `app/[locale]/page.tsx`
- `app/[locale]/catalog/[...vehiclePath]/page.tsx`
- `app/[locale]/search/page.tsx`
- `app/[locale]/parts/[partId]/page.tsx`
- `app/[locale]/vin/page.tsx`
- `app/api/vehicles/makes/route.ts`
- `app/api/vehicles/models/route.ts`
- `app/api/vehicles/generations/route.ts`
- `app/api/vehicles/modifications/route.ts`
- `app/api/parts/search/route.ts`
- `app/api/parts/[partId]/route.ts`
- `app/api/parts/[partId]/crosses/route.ts`
- `app/api/vehicles/[vehicleId]/parts/route.ts`
- `app/api/vin/lookup/route.ts`

Adapt this map to the installed Next.js version and repository conventions. Never expose internal provider endpoints or credentials to clients.

## 8. Data model — initial domain design
Use normalized relational tables and stable primary keys. Exact fields must be refined after inspecting the real source export.

Vehicle domain:
- `vehicle_makes`
- `vehicle_models`
- `vehicle_generations`
- `vehicle_body_types`
- `vehicle_engines`
- `vehicle_modifications` / `vehicle_variants`
- explicit production ranges and source IDs

Parts domain:
- `part_categories` with parent-child hierarchy
- `part_brands`
- `parts`
- `part_numbers` for manufacturer-specific identifiers
- `oe_numbers`
- `part_crosses` with relation type and source/provenance
- `part_fitments` linking parts to precise vehicle variants/modifications
- `part_attributes` or typed attribute tables where justified by query patterns
- `catalog_sources` and `import_batches` for provenance and repeatable imports
- localized translation tables for entity labels/descriptions when needed

VIN domain:
- provider adapter interface and normalized result DTO
- optional minimal audit record with retention policy; avoid storing raw VIN unless needed and justified
- never log full VINs or secrets

Database requirements:
- Foreign keys and appropriate unique constraints.
- Index exact part numbers and OE numbers after normalizing punctuation/case without destroying the original display value.
- Index common fitment and hierarchy lookups.
- Use transactions and idempotent import/upsert logic.
- Preserve original source IDs and batch/version metadata.
- Represent cross-reference relation types explicitly; do not flatten all relationships into an undifferentiated “analogs” list.
- Do not create a table per make/model or duplicate core records per language.

## 9. Search design
MVP search uses PostgreSQL. Implement:
- Exact normalized part-number and OE-number match first.
- Prefix/substring or full-text search for names and descriptions, based on query needs.
- Search across configured locale labels and source-language labels with predictable ranking.
- Filters for brand, category, and verified vehicle fitment.
- Pagination and bounded result sizes.
- Query normalization that preserves original part-number display values.
- Tests for hyphens, spaces, case, mixed Cyrillic/Latin input, and empty/very long queries.

Consider Elasticsearch/OpenSearch only after measuring PostgreSQL query latency and relevance on a realistic catalog sample. Keep search behind a service interface so its implementation can be replaced without changing UI or API contracts.

## 10. VIN provider architecture
- Define a `VinDecoderProvider` interface; isolate vendor-specific code in an adapter.
- Configure provider keys via validated server-only environment variables.
- Validate VIN format without assuming all markets and vehicle types follow identical rules.
- Add timeout, bounded retries, rate limiting, and provider error mapping.
- Return `unknown`, `partial`, and `ambiguous` outcomes explicitly.
- Never infer exact engine/trim or fitment from a partial decode.
- If no provider is configured, show a localized explanation and allow manual vehicle selection; do not fabricate a successful result.
- Document provider coverage, pricing, terms, and data retention before choosing a production provider.

## 11. API contracts and future mobile support
- Keep domain logic out of React components and route handlers; use feature/service modules.
- Define request/response DTOs and validate with Zod.
- Use stable identifiers and version API contracts when breaking changes are needed.
- Return consistent error shapes with localized presentation handled by clients.
- Avoid responses that contain server secrets or unnecessary personal data.
- Keep authentication optional for the public catalog MVP; if accounts are later added, use a standard secure session/token approach and documented authorization rules.
- Write API contract tests so a future Expo client can consume the same endpoints.
- Consider OpenAPI generation after the initial DTOs stabilize.

## 12. Security, privacy, SEO, and performance
- Rate-limit public search and VIN endpoints.
- Validate all path/query/body inputs; constrain pagination and query length.
- Use parameterized queries through the ORM.
- Do not log credentials, raw VINs, or unnecessary personal data.
- Apply appropriate cache headers to stable reference data; do not cache personalized responses publicly.
- Add localized metadata, canonical URLs, `hreflang`, sitemap, and robots rules.
- Use server rendering for indexable catalog pages where useful.
- Add database indexes based on measured query plans.
- Avoid loading the full catalog into the browser; fetch paginated, filtered results.
- Add accessible error boundaries and not-found pages for each locale.

## 13. Testing and definition of done
For each phase:
- TypeScript typecheck passes.
- Lint passes.
- Unit tests cover core selectors, normalization, locale fallback, and search ranking.
- API tests cover validation, empty results, errors, pagination, and provider-unavailable behavior.
- Playwright covers RU/EN routing, locale switch, theme persistence, dependent vehicle filters, part search, and VIN fallback.
- Check keyboard navigation, mobile viewport, and theme contrast.
- No unimplemented visible control is represented as a working feature.
- No compatibility claims are generated from sample/mock data in production mode.

## 14. Implementation phases and agent workflow
### Phase 0A — Deploy first and provision empty PostgreSQL (completed infrastructure milestone)
- Inspect the reference project and the GitHub/Vercel authentication before scaffolding.
- Create the pnpm workspace and CI; publish a bilingual grayscale glass foundation, theme/language switches, honest empty catalog states, and favorite-model storage infrastructure.
- Create isolated local and cloud databases/roles with no catalog rows. Keep secrets ignored and server-only. Do not run seed or invent vehicle models.
- Configure Vercel root `apps/web`, Node 24, GitHub `main`, production domain and separate production/preview env configuration. Preview must not share production credentials; until a separate preview database is provisioned, return database-unavailable there.
- Verify deployment, `/ru`, `/en`, locale/theme persistence, empty model API and database connectivity.
- Confirm read-only VirtualBox access to the running `TecDok` VM. Do not change VM networking, stop it, modify disks or extract data in this phase.
- Document guest file access and license/export blockers separately from VM management access.

### Favorite model storage contract
- Key: `selection-auto-parts:favorite-models:v1`; payload: `{version: 1, modelIds: string[]}`. Store stable model IDs only, never VINs or fabricated labels/fitment.
- Bound at 100 IDs; validate/de-duplicate reads; recover safely from corrupted/version-mismatched payloads.
- Do not overwrite storage on initial hydration. Catch blocked/quota storage errors and show localized feedback.
- Synchronize `storage` events between tabs; resolve labels from the current localized catalog, marking missing models unavailable.
- Favorites need no account and no database records. When the real model API is implemented, connect add/remove controls to source-backed IDs.
- Test persistence, toggle/remove, locale switching, corruption, blocked storage, and tab synchronization.

### Phase 0 — Repository and data reconnaissance
- Inspect files, package manager, Next.js version, Tailwind version, current routes, lint/test scripts, and database setup.
- Do not overwrite or scaffold over existing work.
- Inspect TecDoc export format and legal/license constraints before writing an importer.
- Produce a short findings report and a refined implementation checklist.

### Phase 1 — Extend app foundation and i18n after initial deployment
- Configure strict TypeScript, Tailwind semantic tokens, `next-intl`, `/ru` and `/en` routing, shared layout, locale switcher, theme persistence, and localized metadata.
- Add translation completeness checks and tests.

### Phase 2 — TecDok source reconnaissance, schema and import prototype
- Current authorized delivery (2026-10-09): import all passenger-car and motorbike models/types in RU/EN after validating the Focus sample; import all available parts groups and linked articles for Ford Focus II Saloon (DB_) 1.6, 74 kW, 04.2005–09.2012, source type 18953. No parts photos, prices, stock or VIN data.
- Use `tools/catalog/CatalogExport.cs` inside the VM and `scripts/import-catalog.cjs` for transactional, repeatable local/cloud import. Exports stay ignored under `.cache/catalog-export`; hash and source context are recorded in import_batches.
- Preserve typed replacement relations and full linkage conditions/alternative blocks. Shared OE numbers do not establish universal interchangeability.
- The VM is running Windows 7 (32-bit), Guest Additions 5.2.8, NAT guest address 10.0.2.15. VBoxManage management and file reads through the logged-in desktop session are verified. Shared folder `1` maps host `C:/1` to guest `\\VBOXSVR\1`. Guestcontrol login as gsx without a password remains restricted; the extraction tool instead uses the active session and the installed BDF reader.
- Inspect the actual export/files and permitted use before selecting source IDs, fields or writing an importer. Treat VM name TecDok and catalog product TecDoc separately.
- Source reconnaissance confirmed the installed BDF reader (`TMDVD.DAL.BDF` 1.3.3.0) reports catalog release 2/2018. A full read enumerated 11,631 passenger-car model groups / 68,339 types and 1,543 motorbike groups / 7,504 types. One CHERY group (source ID 11438) has an empty label. The owner's subsequent import/publication confirmation is recorded in `docs/catalog-import.md`; the earlier feasibility report describes the state before that confirmation.
- Initialize source language and country before reading labels, preserve both contexts in provenance, and classify vehicles using the typed source collections rather than IModel flags. Preserve unnamed records as partial; do not invent labels or infer current production from a missing end date in the 2018 snapshot.
- Use a local/offline extraction process; Vercel must not depend on direct access to the workstation/VM. Record source version, original IDs, language and provenance.
- Finalize schema against actual available source fields.
- Import a small representative sample idempotently.
- Validate vehicle hierarchy, OE references, cross-reference relations, and fitment integrity.
- Do not import the full catalog until sample validation succeeds.

### Phase 3 — Vehicle selector and source-backed favorites
- First card: disabled name/part-number search with localized explanation, vehicle kind, searchable make/model, fuel (including hybrid/electric), body, transmission and precise variant, followed by the source-backed parts hierarchy. Changing a parent clears descendants and results; state is shareable via URL.
- Second card: selected model, favorite star to its right, then the selected group's parts with original OE references before aftermarket brand/number and explicit replacement relations. Keep saved models reachable from the first card.
- Build dependent searchable selectors and URL state.
- Connect favorite model add/remove controls to real imported records, restoring the selection using stable IDs.
- Implement loading/error/empty states and unit/E2E tests.

### Phase 4 — Part search and detail pages
- Search engine is deferred by the owner; do not enable the search input until implemented. This delivery provides paginated, precise-variant/group results only.
- Do not import photos. Future client-side internet image lookup by brand + part number (Google Images) is a separate task; keep origin links and do not treat search results as verified catalog images.
- Add PostgreSQL-backed exact and text search, filters, pagination, part pages, OE references, cross-references, and fitment display.

### Phase 5 — VIN provider integration
- Implement provider interface and mock provider for tests only.
- Select a real provider only after coverage, cost, terms, and privacy review.
- Ensure no-provider and ambiguous-result flows work.

### Phase 6 — Hardening and release
- Accessibility, SEO, rate limiting, caching, migrations, backups, monitoring, deployment documentation, and realistic load testing.

### Phase 7 — Mobile readiness
- Stabilize API DTOs and contract tests; build PWA if useful; plan React Native/Expo client separately.

Agent instructions:
1. At the start of each task, state which phase it belongs to and inspect relevant files.
2. Implement only the current phase unless explicitly asked to continue.
3. Before adding a dependency, explain why it is needed and check whether an existing dependency already solves the problem.
4. Never silently change schema, locale URL policy, or API contracts; update docs and tests with changes.
5. At completion, report files changed, commands/tests actually run, results, and remaining blockers.
6. If requirements depend on unavailable catalog data or a paid external provider, implement a clear interface and safe fallback rather than faking production behavior.

## 15. Acceptance criteria
### Infrastructure milestone (first delivery)
- GitHub workspace and CI exist; Vercel project/domain are live.
- Separate local/cloud PostgreSQL databases contain no catalog records and production DB connectivity is verified.
- `/ru` and `/en` render a localized grayscale glass foundation; locale/query preservation and theme reload persistence work.
- No catalog options or compatibility are fabricated; empty/unavailable states are explicit.
- Favorite-model storage contract and UI are ready; source-backed addition is verified with test-only fixtures until import.
- VBoxManage VM status and guest-access limitations are documented.

### First usable catalog milestone
The first usable milestone is complete when:
- `/ru` and `/en` both render the same functional home page in their respective languages.
- Language switching preserves the current supported route.
- Theme switching works in both locales and persists after reload.
- Vehicle selection loads dependent options from PostgreSQL and resets child fields when a parent changes.
- Search can find imported sample parts by exact part number/OE number and by localized/source-language name.
- Part details show only source-backed fitment and cross-reference relationships.
- VIN page validates input and falls back to manual vehicle selection when no provider is configured.
- Tests cover these behaviors and all quality checks pass.
