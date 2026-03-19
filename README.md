# LunchTool

A daily lunch coordination app for teams. Powered by Cloudflare Zero Trust auth, FastAPI, React, and SQLite.

## Features

- **Vote** on where to eat (before 11:00)
- **Host role** — one person takes charge, picks the restaurant, and shares a payment link
- **Payment QR code** — payment URL is instantly converted to a scannable QR code
- **Orders** — everyone submits what they want; the host places one combined order
- **Pickup info** — host sets exact location and time after ordering
- **Paid tracking** — each person marks their own order as paid

## Stack

| Layer | Technology |
|-------|-----------|
| Auth | Cloudflare Zero Trust (`Cf-Access-Authenticated-User-Email` header) |
| Backend | Python / FastAPI |
| Database | SQLite (via SQLAlchemy) |
| Frontend | React + Vite + Tailwind CSS |
| Serving | nginx (proxies `/api` to backend) |
| Deploy | Docker Compose |

## Running

### Prerequisites

- Docker + Docker Compose
- A Cloudflare Zero Trust tunnel pointing at port `3045` on the host
- The `mediationportal_default` Docker network must exist

```bash
docker network create mediationportal_default   # skip if it already exists
```

### Start

```bash
docker compose up -d --build
```

The app is available at port **3045**.

### Local development (without Cloudflare tunnel)

Uncomment the `DEV_EMAIL` line in `docker-compose.yml` to bypass CF auth:

```yaml
environment:
  - DEV_EMAIL=you@example.com
```

For frontend hot-reload, run the Vite dev server separately:

```bash
cd frontend && npm install && npm run dev
```

It proxies `/api` calls to `http://localhost:8000` (see `vite.config.js`).

## Session flow

```
Before 11:00  → Voting phase
                Everyone picks a restaurant and says whether they're joining.

After 11:00   → Voting closes
                Someone clicks "Become Host", confirms the restaurant.

Ordering      → Host shares a payment URL (Tikkie, PayPal.me, Revolut, …)
                A QR code is shown to all users.
                Everyone submits their individual order.

Pickup        → Host has ordered and sets pickup location + time.
                Each person marks themselves as paid.
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:////data/lunchtool.db` | SQLAlchemy DB URL |
| `TZ` | `Europe/Amsterdam` | Timezone for the 11:00 voting cutoff |
| `DEV_EMAIL` | — | Bypass CF auth in local dev |
