<div align="center">
  <h1>🌽 Bob's Corn API</h1>
  <p><strong>Production-Ready E-Commerce Backend with Fair-Trade Rate Limiting</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node Version" />
    <img src="https://img.shields.io/badge/express-4.x-blue" alt="Express Version" />
    <img src="https://img.shields.io/badge/sqlite-3.x-orange" alt="SQLite Version" />
  </p>

  <p>
    <a href="#-features">Features</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-api-documentation">API Docs</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="#-deployment">Deployment</a> •
  </p>
</div>

---

## 📖 Overview

**Bob's Corn API** is a robust, scalable backend service built for an e-commerce platform specializing in artisanal corn products. This project demonstrates senior-level engineering practices through implementation of a unique business requirement: **fair-trade rate limiting** that ensures equitable product distribution.

### 🎯 Business Context

Bob is a fair farmer who believes in equitable distribution. The core business rule enforces:
> **Maximum 1 corn per customer per minute per product**

This prevents bulk buying and ensures all customers have access to fresh corn. The rate limiting is implemented at the application level with detailed tracking and transparent error responses.

### 💼 Technical Interview Context

This backend was developed as a take-home exercise demonstrating:
- **Production-ready code** with comprehensive error handling
- **Clean architecture** with separation of concerns
- **Security best practices** including JWT authentication and input validation
- **Scalable design patterns** suitable for real-world deployment
- **Professional documentation** and code organization

## ✨ Features

### Core Functionality
- **🔐 JWT Authentication** - Secure token-based authentication system
- **⏱️ Smart Rate Limiting** - Per-user, per-product purchase limits (Bob's Fair Trade Policy)
- **🛒 Order Management** - Transactional order processing with detailed history
- **🔍 Product Search** - Full-text search across multiple product fields
- **📦 Product Catalog** - Dynamic product management with categories and featured items
- **👤 User Profiles** - Account management with saved shipping addresses
- **📊 Structured Logging** - Production-ready logging with Winston and request tracing
- **🛡️ Security Hardened** - Helmet, CORS, input validation, SQL injection prevention

### Technical Excellence  
- **Clean Architecture** - MVC pattern with clear separation of concerns
- **Database Transactions** - ACID compliance for critical operations
- **Request Tracing** - UUID-based request tracking for debugging
- **Environment Configuration** - Flexible deployment with dotenv
- **Comprehensive Documentation** - JSDoc comments and API documentation
- **Error Handling** - Graceful error responses with appropriate HTTP status codes
- **Data Validation** - Input sanitization using express-validator
- **Password Security** - Bcrypt hashing with configurable salt rounds

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/bobs-corn-backend.git
cd bobs-corn-backend

# Install dependencies
npm install

# Set up environment variables
cp server/.env.example server/.env

# Start the development server
npm start
```

The API will be available at `http://localhost:4000` 🎉

### Verify Installation

```bash
# Check health endpoint
curl http://localhost:4000/health

# Expected response:
# {"status":"ok","uptime":12.34,"env":"development","now":"2024-01-01T12:00:00.000Z"}
```

## 🌱 Database Seeding

The project includes a sophisticated seeding system for development and testing.

### Quick Seed Commands

```bash
# Seed with default dataset (20 products, 10 users, 15 orders)
npm run seed

# Reset database and seed with larger dataset
npm run seed:reset

# Preview seed data without writing to database
npm run seed:dry
```

### Advanced Seeding Options

```bash
# Custom seed counts
node server/seed.js --products=100 --users=50 --orders=200

# Available flags:
#   --reset       Clear all tables before seeding
#   --dry         Preview mode (no database writes)
#   --verbose     Detailed logging output
#   --products=N  Number of products to generate
#   --users=N     Number of users to generate
#   --orders=N    Number of orders to generate
```

### Demo Account

A demo account is automatically created during seeding:
- **Email**: `demo@bobs.corn`
- **Password**: Set via `SEED_PASSWORD` env variable (default: `Passw0rd!`)

> **Note**: All seeded users share the same password for easy testing.

## 📚 API Documentation

### Base URL
```
http://localhost:4000
```

### Authentication

The API uses JWT (JSON Web Token) authentication. Include the token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

### Rate Limiting

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| General API | 100 requests | 15 minutes |
| Auth endpoints | 20 requests | 15 minutes |
| Purchase endpoint | 1 item per product | 60 seconds |

### Core Endpoints

#### 🏥 Health Check

```http
GET /health
```

<details>
<summary>View Response</summary>

```json
{
  "status": "ok",
  "uptime": 3600.5,
  "env": "production",
  "now": "2024-01-01T12:00:00.000Z"
}
```
</details>

#### 🔐 Authentication

##### Sign Up
```http
POST /api/auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

##### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

##### Get Profile
```http
GET /api/auth/me
Authorization: Bearer <token>
```

#### 🌽 Products

##### List Products
```http
GET /api/products?limit=10
```

##### Get Product
```http
GET /api/products/premium-yellow-corn
```

##### Search Products
```http
GET /api/products/search?q=organic
```

##### Get Featured Products
```http
GET /api/products/featured
```

#### 🛒 Orders (Rate Limited!)

##### Purchase Products
```http
POST /api/orders/purchase
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    {
      "slug": "premium-yellow-corn",
      "quantity": 1
    }
  ],
  "shippingAddress": {
    "street": "123 Corn Street",
    "city": "Cornville",
    "state": "IA",
    "zipCode": "12345",
    "country": "USA"
  }
}
```

<details>
<summary>View Rate Limit Error (429)</summary>

```json
{
  "error": "Rate limit exceeded for product 'premium-yellow-corn'. Limit is 1 per 60 seconds.",
  "limit": 1,
  "windowSeconds": 60,
  "product": {
    "id": "1",
    "slug": "premium-yellow-corn",
    "requestedQuantity": 2,
    "recentPurchasedQuantity": 1
  }
}
```
</details>

##### List Orders
```http
GET /api/orders
Authorization: Bearer <token>
```

##### Get Order Details
```http
GET /api/orders/123
Authorization: Bearer <token>
```

For complete API documentation with all endpoints and examples, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

## 🏗️ Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|----------|
| **Runtime** | Node.js 18+ | JavaScript runtime |
| **Framework** | Express.js 4.x | Web application framework |
| **Database** | SQLite 3 | Lightweight, file-based database |
| **ORM** | Knex.js | SQL query builder and migrations |
| **Authentication** | JWT + bcrypt | Token-based auth with secure hashing |
| **Validation** | express-validator | Input sanitization and validation |
| **Security** | Helmet | Security headers middleware |
| **Logging** | Winston | Structured logging |
| **Rate Limiting** | express-rate-limit | Request throttling |

### Project Structure

```
bobs-corn-backend/
├── server/
│   ├── controllers/        # Business logic layer
│   │   ├── authController.js       # Authentication logic
│   │   ├── ordersController.js     # Order processing & rate limiting
│   │   ├── productsController.js   # Product catalog management
│   │   ├── accountController.js    # User account management
│   │   └── healthController.js     # Health check endpoint
│   ├── routes/             # API route definitions
│   │   ├── auth.js                 # Auth endpoints
│   │   ├── orders.js               # Order endpoints
│   │   ├── products.js             # Product endpoints
│   │   ├── account.js              # Account endpoints
│   │   ├── search.js               # Search endpoints
│   │   └── health.js               # Health endpoint
│   ├── middleware/         # Custom middleware
│   │   └── auth.js                 # JWT verification
│   ├── index.js           # Application entry point
│   ├── db.js              # Database configuration
│   ├── logger.js          # Logging configuration
│   ├── seed.js            # Database seeder CLI
│   ├── productsSeed.js    # Initial product data
│   └── .env.example       # Environment variables template
├── logs/                  # Application logs (gitignored)
├── data.sqlite3           # SQLite database file (gitignored)
├── package.json           # Dependencies and scripts
├── package-lock.json      # Dependency lock file
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

### Database Schema

```sql
-- Users table: Authentication and profile storage
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  address TEXT, -- JSON
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table: Product catalog
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  rating FLOAT,
  rating_count INTEGER,
  tags TEXT, -- JSON array
  images TEXT, -- JSON array
  options TEXT, -- JSON object
  description TEXT,
  details TEXT, -- JSON array
  specs TEXT, -- JSON object
  badges TEXT, -- JSON array
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table: Purchase transactions
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total DECIMAL(10,2) NOT NULL,
  shipping_address TEXT, -- JSON
  status VARCHAR(50) DEFAULT 'paid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items table: Line items for each order
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  slug VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL
);
```

### Request Flow

1. **Request arrives** → Express server
2. **Security middleware** → Helmet headers, CORS validation
3. **Logging middleware** → Request ID generation, timing start
4. **Rate limiting** → General API limits
5. **Route matching** → Express router
6. **Authentication** → JWT verification (if required)
7. **Validation** → express-validator rules
8. **Controller logic** → Business rules, database queries
9. **Response** → JSON serialization
10. **Logging** → Response time, status code

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Server Configuration
PORT=4000
NODE_ENV=development

# Security
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=1h
BCRYPT_ROUNDS=12

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Database
DB_FILE=../data.sqlite3
SKIP_INITIAL_PRODUCT_SEED=false

# Rate Limiting (Bob's Fair Trade Policy)
PURCHASE_RATE_LIMIT_PER_PRODUCT=1
PURCHASE_RATE_LIMIT_WINDOW_SECONDS=60

# Seeding
SEED_PASSWORD=Passw0rd!

# Logging
LOG_LEVEL=debug
```

### Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` as template
2. **Use strong JWT secrets** - Generate with `openssl rand -base64 32`
3. **Adjust bcrypt rounds** - Balance security vs performance (10-14 recommended)
4. **Configure CORS strictly** in production - Never use `*`
5. **Set appropriate rate limits** based on your business needs
6. **Enable HTTPS** in production with SSL certificates
7. **Use environment-specific configs** for different deployment stages

## 🚢 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate secure `JWT_SECRET`
- [ ] Configure specific `ALLOWED_ORIGINS`
- [ ] Set up HTTPS with SSL certificates
- [ ] Configure production database (PostgreSQL/MySQL recommended)
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation service
- [ ] Set up automated backups
- [ ] Review and adjust rate limits
- [ ] Enable CORS for specific domains only

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4000
CMD ["npm", "start"]
```

### PM2 Process Management

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server/index.js --name bobs-corn-api

# Save PM2 configuration
pm2 save
pm2 startup
```

## 🧪 Testing

### Run Tests
```bash
npm test
```

### API Testing with cURL

```bash
# Health check
curl http://localhost:4000/health

# Create account
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Test123!"}'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Get products
curl http://localhost:4000/api/products

# Purchase (with token)
curl -X POST http://localhost:4000/api/orders/purchase \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"slug":"premium-yellow-corn","quantity":1}]}'
```

## 🙏 Acknowledgments

- Built as a technical assessment for a senior engineering position
- Demonstrates production-ready backend development practices
- Special focus on rate limiting and fair distribution algorithms