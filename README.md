# LevelUp

Онлайн-платформа для обучения IT (React + Vite) с backend API для заказов и активации подписки PRO/AI PRO.

## Быстрый запуск

1. Скопируйте переменные:

```bash
cp .env.example .env
```

2. Установите зависимости:

```bash
npm install
```

3. Запустите backend:

```bash
npm run backend:dev
```

4. Запустите frontend (в другом терминале):

```bash
npm run dev
```

## Production-команды

- Backend: `npm run backend:start`
- Frontend build: `npm run build`
- Frontend preview: `npm run preview`

## Переменные для реальных платежей

Заполняются в `.env`:

- `PAYMENT_API_BASE_URL` — базовый URL официального API провайдера/агрегатора.
- `PAYMENT_MERCHANT_ID` — Merchant ID вашего магазина.
- `PAYMENT_API_KEY` — приватный API-ключ для создания платежа.
- `PAYMENT_WEBHOOK_SECRET` — секрет подписи webhook.
- `PAYMENT_CREATE_ORDER_PATH` — endpoint создания платежа (по умолчанию `/v1/orders`).
- `PAYMENT_METHOD_MBANK_CODE`, `PAYMENT_METHOD_ELSOM_CODE`, `PAYMENT_METHOD_ODENGI_CODE` — коды методов оплаты у выбранного провайдера.
- `BACKEND_PUBLIC_URL` — публичный URL backend для webhook.
- `FRONTEND_URL` — URL frontend для возврата пользователя.

## Важно по безопасности

- Секреты платежей хранятся только на backend.
- Подписка активируется только после webhook-подтверждения оплаты.
- Повторная активация одного и того же платежа блокируется через idempotency-проверки и ограничения БД.
