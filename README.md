# Feedback Service

Профессиональный сервис для сбора обратной связи от клиентов, интегрированный с Битрикс24 CRM.

## Стек технологий

- **Фреймворк**: Next.js (App Router)
- **Стилизация**: Tailwind CSS + Framer Motion
- **База данных**: PostgreSQL (Supabase) + Prisma ORM
- **Деплой**: Node.js за nginx, процесс-менеджер PM2 (self-host на Linux VM)

## Быстрый старт (Локально)

1. Установите зависимости: `npm install`
2. Настройте `.env` (используйте строки подключения из Supabase)
3. Синхронизируйте базу: `npx prisma db push`
4. Запустите: `npm run dev`

## Сборка и деплой (self-host)

Прод работает на `https://feedback.alleyadoma.ru` (Node.js + PM2 за nginx).

1. Публичные переменные на этапе сборки задаются в `.env.production`
   (например, `NEXT_PUBLIC_APP_URL=https://feedback.alleyadoma.ru`). Они
   **впекаются в бандл** на `next build`, поэтому должны быть заданы до сборки.
2. Серверные секреты (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`,
   `AUTH_SECRET`, `ADMIN_*`) лежат в `.env` на сервере (mode 600, не в git)
   и читаются в рантайме.
3. Сборка: `npm run build` (используется webpack; Turbopack отключён —
   он несовместим с Prisma в режиме `next start`).
4. На сервере: `npx prisma generate`, затем запуск через PM2
   (`pm2 start ecosystem.config.js`). Автозапуск после ребута — через
   `crontab @reboot`.
5. nginx проксирует `feedback.alleyadoma.ru` на `127.0.0.1:3000`.

## Интеграция с Битрикс24

1. В админ-панели сервиса (`/admin/integration`) укажите ваш **Входящий вебхук** из Битрикс24.
2. В Битрикс24 настройте Робота на финальную стадию воронки (сделки или лида),
   используя URL вебхука нашего сервиса:
   - для сделок: `https://feedback.alleyadoma.ru/api/b24/webhook?clientId={{ID}}&dealId={{ID}}`
   - для лидов: `https://feedback.alleyadoma.ru/api/b24/webhook?clientId={{ID}}&leadId={{ID}}&entityType=lead`
