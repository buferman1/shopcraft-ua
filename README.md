# ShopCraft UA

Українська SaaS-платформа для створення fashion-магазинів.

## Поточний стан

Розробка розпочата. Це не готовий production-реліз.

Стек: Next.js, React, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL/Storage, Zod, React Hook Form, Zustand, Vitest, Playwright. Stripe — тестове середовище, до окремого налаштування.

## Перевірки перед релізом

- Реальна база даних і міграції.
- RLS та перевірки ізоляції магазинів.
- Авторизація та контроль ролей на сервері.
- Транзакційне оформлення замовлень і облік залишків.
- Перевірка webhook та ідемпотентність.
- Unit, integration, E2E, accessibility та build.
- Preview перед production deployment.

## Етапи

1. Інфраструктура й авторизація.
2. Магазини, ролі, кабінет.
3. Товари, варіанти, склад і медіа.
4. Конструктор, шаблони, версії й публікація.
5. Вітрина, кошик і замовлення.
6. Підписки й тарифи.
7. SEO, аналітика й маркетинг.
8. Домени та адаптери інтеграцій.
9. Адміністрування, безпека й реліз.

## Секрети

Не зберігати ключі, токени, персональні дані або паролі в Git. Секрети — лише в захищених environment variables / Supabase Secrets.

## Початкова основа

`npm ci`, `npm run lint`, `npm run build`.

### Supabase

Підключено Supabase-проєкт у регіоні `eu-central-1` (PostgreSQL 17). Міграція створює базові профілі, магазини, членство й ролі, каталог, варіанти товарів, клієнтів, замовлення та журнал аудиту. Усі 10 таблиць мають RLS; медіафайли завантажуються в bucket `store-media`.

Клієнти для браузера, Server Components/Route Handlers і Next.js Proxy розміщені в `src/lib/supabase/`. Proxy оновлює сесії через перевірку JWT; перевірку доступу до даних надалі потрібно робити серверно та через RLS.

Для локального запуску скопіюйте `.env.example` у `.env.local` і задайте `NEXT_PUBLIC_SUPABASE_URL` та `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` з налаштувань Supabase. Файл `.env.local` ігнорується Git. Publishable key призначений для браузера; secret/service-role key не додавати до `NEXT_PUBLIC_*` і не комітити.

Для Vercel додайте ті самі дві змінні до Project Settings → Environment Variables для Preview і Production, перш ніж створювати deployment.

Базова схема ще не охоплює всі функції платформи. `/api/health` робить легкий запит через Data API та повертає стан з’єднання без розкриття секретів. Не використовувати як готовий магазин.

Supabase MCP повертає Unknown tool; реальна база, міграції та Auth ще не створені. Vercel-проєкт ще не створений.
