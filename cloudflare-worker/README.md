# GeekNook Cloudflare Worker + Durable Object (Бесплатный серверный склад)

Этот Worker хранит таблицу остатков в приватном Durable Object (SQLite на Free Plan),
атомарно списывает товары при заказах всех покупателей и проверяет пароль администратора строго на сервере.

## Деплой за 3 шага

1. Авторизуйтесь в Cloudflare и задеплойте Worker (бесплатный план):
   ```bash
   cd cloudflare-worker
   npx wrangler login
   npx wrangler deploy
   ```
   В ответе появится URL вида `https://geeknook-stock.<ваш-аккаунт>.workers.dev`.

2. Задайте секретный пароль администратора (не попадёт в код и Git):
   ```bash
   npx wrangler secret put STOCK_ADMIN_KEY
   ```

3. Загрузите актуальный прайс из корня репозитория и вставьте URL в `js/products-data.js` (`DEFAULT_STOCK_WORKER_URL`):
   ```bash
   cd ..
   STOCK_ADMIN_KEY="ваш-пароль" python3 scripts/import-stock.py путь/к/прайсу.xlsx --push-worker https://geeknook-stock.<аккаунт>.workers.dev
   ```
