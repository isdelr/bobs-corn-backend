Bob's Corn — Express + SQLite Backend

Overview
This repository contains a minimal Express.js backend that can feed the Bob's Corn frontend. It incorporates recommended security and developer-experience packages and persists data in a local SQLite database via Knex.

Key packages
- Security: helmet, express-rate-limit, bcrypt, express-validator
- Database: sqlite3, knex
- DX: cors, dotenv, winston (colorized console in dev, JSON to files)

Quick start
1) Install dependencies
   npm install

2) Configure environment (optional)
   Copy server/.env.example to server/.env and adjust values as needed. Defaults are fine for local development.

3) Run the server
   npm start
   Server will start on http://localhost:4000 (configurable via PORT).

Seeding
- Use the built-in seeder to generate realistic users, products, and orders.

Commands
- Seed default dataset:
  npm run seed
- Reset and reseed larger dataset:
  npm run seed:reset
- Dry run (no writes), useful to preview:
  npm run seed:dry

Direct CLI options
- You can pass flags to adjust counts:
  node server/seed.js --products=80 --users=25 --orders=40
- Other flags:
  --reset       Clear all tables before seeding
  --dry         Do not write to the database
  --verbose     Log extra details

Notes
- Generated users share the default password from `server/.env` (`SEED_PASSWORD`, default: `Passw0rd!`).
- A demo account is always created: `demo@bobs.corn` using the same seed password.
- The app's minimal initial product seed can be disabled with `SKIP_INITIAL_PRODUCT_SEED=true`. The seeder sets this automatically when it runs.

API endpoints
- GET /health
  Simple health check.

- GET /api/products?limit=NUMBER
  Returns a list of products. Optional limit parameter caps the number of items (max 100).

- GET /api/products/:slug
  Returns a single product by slug.

- GET /api/search?q=TERM
  Full-text style simple search across title, subtitle, description, and tags.

- POST /api/auth/signup
  Body: { name, email, password }
  Validates input, hashes password with bcrypt, stores user, and returns { id, name, email }.

- POST /api/auth/login
  Body: { email, password }
  Validates input, verifies bcrypt password, returns { id, name, email }.

Notes
- The database file (SQLite) is created on first run at data.sqlite3 while the app seeds a few sample products (matching the frontend's mock data).
- CORS is enabled. Configure allowed origins via ALLOWED_ORIGINS (comma-separated or * for all; use * only during local development).
- Rate limiting is applied globally (100 requests / 15 min) and stricter on auth endpoints.

Project structure
- /server
  - index.js: Express app setup and router mounting
  - logger.js: Winston logger and HTTP logging middleware
  - controllers/: route handlers (authController.js, productsController.js, healthController.js)
  - routes/: route definitions (auth.js, products.js, search.js, health.js)
  - db.js: Knex setup, schema creation, and seeding
  - productsSeed.js: initial product rows used on first run
  - seed.js: CLI data generator for users, products, and orders
  - .env.example: sample env configuration

Environment variables (server/.env)
- PORT=4000
- ALLOWED_ORIGINS=*
- DB_FILE=./data.sqlite3
- BCRYPT_ROUNDS=12

Integrating with the frontend
The current frontend example you provided uses in-memory data and client-side stores. Once you're ready to switch to the API:
- Replace the product data hooks to fetch from:
  - GET http://localhost:4000/api/products
  - GET http://localhost:4000/api/products/:slug
  - GET http://localhost:4000/api/search?q=...
- Wire login/signup forms to POST to:
  - POST http://localhost:4000/api/auth/login
  - POST http://localhost:4000/api/auth/signup

Security hardening (production)
- Set explicit ALLOWED_ORIGINS to your deployed frontend origin(s).
- Put the server behind a reverse proxy (e.g., NGINX) and enable HTTPS.
- Consider adding JWT-based auth if you need authenticated routes beyond login/signup.
- Tune rate limits based on expected traffic and add per-route limits for sensitive endpoints.

License
MIT


Example requests (PowerShell)
- Health:    curl http://localhost:4000/health
- Products:  curl http://localhost:4000/api/products
- Product:   curl http://localhost:4000/api/products/farm-fresh-yellow-kernels
- Search:    curl "http://localhost:4000/api/search?q=caramel"
- Signup:    curl -X POST http://localhost:4000/api/auth/signup -H "Content-Type: application/json" -d '{"name":"Alice","email":"alice@example.com","password":"secret123"}'
- Login:     curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"email":"alice@example.com","password":"secret123"}'


Knex usage and configuration notes
- Knex requires a database driver. This project uses SQLite with the sqlite3 driver (see package.json). For other databases install the appropriate driver (pg, mysql2, better-sqlite3, tedious, etc.).
- Initialize Knex once per application. This repo exports a single shared instance from server/db.js.
- SQLite connections use a filename, not host/port. Configure via DB_FILE (.env). To use in-memory, you could set filename to :memory:.
- For SQLite, useNullAsDefault: true is enabled to treat undefined values as NULL.
- The pool for SQLite is a single connection by default in Knex. For MySQL/PostgreSQL, consider pool: { min: 0 } to avoid stale idle connections (per Knex docs).
- afterCreate hook enables PRAGMA foreign_keys = ON for SQLite in this project.
- Insert/Update/Delete returning: In SQLite/MySQL the default insert response is an array with the inserted id(s); PostgreSQL requires .returning(...) to get rows back.
- Optional settings you may enable if needed: acquireConnectionTimeout, debug, asyncStackTraces, migrations config, wrapIdentifier/postProcessResponse, etc. Refer to Knex docs for details.
