# ShopCraft UA

Українська SaaS-платформа для fashion-магазинів. **Розробка триває; це ще не production-реліз.**

## Реалізовано

- Next.js 16, React, TypeScript, Tailwind; адаптивні сторінки українською.
- Supabase PostgreSQL/Auth/Storage; браузерний і серверний клієнти, cookie-сесії, Proxy.
- Форми email-реєстрації, входу, підтвердження через PKCE callback, відновлення та зміни пароля, виходу. React Hook Form і серверна Zod-валідація.
- Кабінет, створення кількох магазинів, профіль. Створення власника магазину й профілю через тригери.
- Ролі owner/admin/manager/editor/support; перевірка прав у Server Actions та RLS у БД.
- Створення й редагування товарів, ціна/SKU/SEO slug/статус, архівація та відновлення через статус.
- Пошук, фільтр статусу, сортування та пагінація каталогу по 25 товарів.
- Категорії, варіанти розмірів/кольорів, окремі SKU та залишки; зміна залишків.
- Фото товарів у Supabase Storage: PNG/JPEG/WebP до 5 МБ, перевірка сигнатури файлу, tenant-папки.
- Журнал змін каталогу, захист зміни власника магазину, 11 таблиць із RLS і складеними tenant foreign keys.
- `/api/health` перевіряє реальний запит до Data API, не повертає приватні дані.

## Локальний запуск

Node.js 24. Скопіюйте `.env.example` у `.env.local`, заповніть:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```sh
npm ci
npm run dev -- --hostname 127.0.0.1
```

`.env.local` ігнорується Git. Secret/service-role key не потрібен для цього етапу та не використовується в браузері. Supabase пакети закріплені точними версіями; lockfile входить у репозиторій.

## Email Auth і deployment

1. У Supabase Auth URL Configuration задайте фактичний Site URL і дозволені `/auth/callback` URL для локального/preview/production середовища. Відновлення використовує `/auth/callback?next=/auth/update`.
2. Не вимикайте підтвердження email для production. Перевірте реальну доставку листів і обмеження вашого SMTP.
3. У Vercel створіть/зв’яжіть проєкт із репозиторієм і додайте три public-змінні вище для відповідного середовища; APP_URL має відповідати адресу deployment.
4. Після deployment перевірте реєстрацію → email → callback → магазин → товар → фото → вихід/повторний вхід.

Ці поштові сценарії ще не пройдені наскрізно з реальною поштою. Vercel preview гілки `feat/auth-and-catalog` розгорнуто; `/api/health` підтверджує з’єднання з базою. Production-реліз ще не готовий. Авторизація спирається на вбудовані обмеження Supabase Auth; окремий distributed rate limiter для бізнес-дій ще не реалізований.

## База даних

Проєкт: `lsjtcqbxkheubyrlfsdg`, регіон `eu-central-1`. Дві застосовані міграції збережені в `supabase/migrations/`; їхні версії збігаються з hosted migration history. Після блокування CLI через telemetry друга міграція виконана робочим Supabase MCP API, без запуску CLI. `supabase/config.toml` призначений для локальної розробки; він не змінює hosted Auth settings.

Не застосовуйте архівні/експериментальні SQL-файли. Зміни RLS та індексів перевірені advisors: security WARN/ERROR відсутні, performance WARN/ERROR відсутні. INFO `unused_index` очікуваний у новій порожній базі.

## Перевірки

```sh
npm test                  # Vitest: валідація, ролі, redirect allowlist, сигнатури фото
npm run lint
npm run build
node tests/run-http.mjs    # запускає production-сервер і перевіряє HTTP + реальну БД
npx playwright install chromium
npm run test:e2e           # desktop і mobile: публічні сценарії та захист кабінету
```

`tests/store-creation.test.ts` відтворює ситуацію, коли `INSERT ... RETURNING` блокується SELECT-політикою до виконання тригера членства. Server Action генерує UUID, виконує INSERT без RETURNING і переходить до нового магазину після завершення транзакції. Тест також перевіряє конфлікт адреси, відсутність запису без входу та ігнорування переданого клієнтом власника/ID. Зміни RLS або привілейовані ключі для виправлення не потрібні.

Окремий сценарій `tests/integration/catalog-actions.test.ts` викликає справжні Server Actions із клієнтом реального Supabase. Він перевіряє створення магазину, категорії й товару, редагування, варіанти/залишки, фактичне завантаження й читання PNG, відхилення підробленого фото, ізоляцію іншого акаунта, audit log та повторний вхід. Тільки Next redirect/cache і отримання серверного клієнта замінені тестовими адаптерами; Auth, SQL/RLS та Storage залишаються реальними.

Для цього сценарію використовуйте тестовий Supabase та два тимчасові підтверджені акаунти. Файл поза Git має структуру `{"users":[{"id":"USER_A_UUID","email":"TEST_A_EMAIL","password":"TEST_A_PASSWORD"},{"id":"USER_B_UUID","email":"TEST_B_EMAIL","password":"TEST_B_PASSWORD"}],"stores":[],"objects":[]}`. Тест дописує створені store IDs і шляхи фото для очищення; фото прибирає в `finally`. Після запуску видаліть тільки ці тестові магазини/акаунти й файл із паролями.

```sh
SHOPCRAFT_API_FIXTURE_FILE=/absolute/private/fixture.json \
  node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/integration
```

Без `SHOPCRAFT_API_FIXTURE_FILE` live-сценарій пропускається, тому звичайний CI не пише в реальну базу. Підтвердження email та браузерні дії після входу цим API-сценарієм не перевіряються.

`supabase/tests/tenant_isolation.sql` виконується через SQL Editor або MCP у тестовому проєкті. У транзакції створює тимчасові записи та перевіряє читання/запис між tenants, приватність профілю, owner bootstrap, composite FK, негативний залишок, support-роль, анонімне читання та audit trigger. Наприкінці — ROLLBACK, тестові записи не залишаються.

Останні локальні результати: 24 unit-тести, lint, build, 9 HTTP-перевірок і SQL tenant-isolation suite пройшли. Live-сценарій Server Actions/Auth/Data API/Storage також пройшов на тимчасових підтверджених акаунтах із фактичним PNG upload/download та негативними перевірками доступу; тестові дані очищено. Публічні desktop/mobile E2E запускалися успішно в GitHub CI. Авторизовані UI-сценарії, повний accessibility-аудит і email-flow ще потребують перевірки.

## Наступні етапи

- Повний onboarding, налаштування магазину, керування командою, dashboard продажів.
- Публікація вітрини, 10 шаблонів, drag-and-drop конструктор, версії та автозбереження.
- Кошик, транзакційний checkout, замовлення, резервування/списання залишків.
- Stripe billing, webhooks, тарифні ліміти, invoices; реальні платіжні інтеграції лише після налаштування.
- Доставка, домени, email-провайдер, SEO, аналітика, купони, Super Admin.
- Приватність/GDPR-процеси, резервні копії й restore drills, повна перевірка перед production.

Зміна статусу товару на «Активний» ще не публікує магазин. Публікація, замовлення та платежі не імітуються.
