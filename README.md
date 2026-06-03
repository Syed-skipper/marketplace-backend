# Multi-Vendor Marketplace Backend

Production-ready Node.js + Express + TypeScript + PostgreSQL + Prisma marketplace API.

## Quick Start

```bash
cd marketplace-backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/docs
- Health: http://localhost:3000/health

## Default Admin (after seed)

- Email: `admin@marketplace.local`
- Password: `Admin@123456`

## Documentation

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full system design (22 sections).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run test` | Run tests with coverage |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed roles, permissions, admin |
