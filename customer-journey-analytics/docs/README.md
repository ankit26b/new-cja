# Customer Journey Analytics (CJA)

A full-stack application for tracking and analyzing user journeys across a website. It includes a **React frontend**, **Node.js/Express backend**, **PostgreSQL database**, and an **ML service** (FastAPI + XGBoost + BERT) for drop-off prediction and sentiment analysis.

---

## Quick Start with Docker (Recommended)

> **Prerequisites:** Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose).

### 1. Clone the repository

```bash
git clone <repository-url>
cd customer-journey-analytics
```

### 2. Create environment file

```bash
cp .env.example .env
```

Edit `.env` if you want to change defaults (passwords, admin credentials, etc.).

### 3. Run database setup (first time only)

```bash
docker compose --profile setup up db-setup
```

This creates the database tables and seeds an admin user.

### 4. Start all services

```bash
docker compose up --build
```

That's it! All four services will start:

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **Backend API** | http://localhost:5000 |
| **ML API** | http://localhost:8000 |
| **PostgreSQL** | localhost:5432 |

### 5. Log in

Use the default admin credentials:

| Field | Value |
|-------|-------|
| Email | `admin@example.com` |
| Password | `Admin123!` |

> Change these in `.env` before running the setup step if you want different credentials.

### Docker Commands Reference

```bash
# Start all services
docker compose up --build

# Start in background (detached)
docker compose up -d --build

# Stop all services
docker compose down

# Stop and remove all data (database included)
docker compose down -v

# View logs
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend

# Re-run database setup
docker compose --profile setup up db-setup
```

---

## Manual Setup (Without Docker)

### Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | v18+ | https://nodejs.org |
| **npm** | comes with Node.js | - |
| **PostgreSQL** | v14+ | https://www.postgresql.org/download |
| **Python** | 3.9+ | https://www.python.org/downloads |
| **Git** | any recent version | https://git-scm.com |

### 1. Clone the Repository

```bash
git clone <repository-url>
cd customer-journey-analytics
```

### 2. Backend Setup

#### 2.1 Install dependencies

```bash
cd backend
npm install
```

#### 2.2 Configure environment variables

Create a `.env` file inside the `backend/` folder:

```dotenv
# Server
PORT=5000

# Database
DB_USER=postgres
DB_HOST=localhost
DB_NAME=cja
DB_PASSWORD=your_postgres_password
DB_PORT=5432

# JWT
JWT_SECRET=cja_secret_key

# Admin Seed (used by setup_db.js)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin123!
ADMIN_USERNAME=admin
```

> **Note:** Update `DB_PASSWORD` with your actual PostgreSQL password.

#### 2.3 Create the PostgreSQL database

Open a terminal or `psql` and create the database:

```sql
CREATE DATABASE cja;
```

#### 2.4 Run database setup (create tables and seed admin)

```bash
node setup_db.js
```

This will create the `users`, `sessions`, `events`, and `session_features` tables, and seed an admin user if one doesn't exist.

#### 2.5 Run multi-tenant migration (`site_id`) for existing databases

If your DB already existed before the `site_id` update, run:

```bash
node run_migration.js
```

This migration is idempotent and will:
- add `site_id` to `sessions`, `events`, and `session_features`
- backfill existing rows with `default_site`
- create indexes on `site_id`

You can verify in `psql`:

```sql
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('sessions', 'events', 'session_features')
	AND column_name = 'site_id'
ORDER BY table_name;
```

#### 2.6 Start the backend server

```bash
# Development (auto-restart on changes)
npm run dev

# OR Production
npm start
```

The backend will run at **http://localhost:5000**.

---

### 3. Frontend Setup

#### 3.1 Install dependencies

```bash
cd frontend
npm install
```

#### 3.2 Start the development server

```bash
npm run dev
```

The frontend will run at **http://localhost:5173** (default Vite port).

---

### 4. ML Models Setup (Optional)

The ML service provides drop-off prediction (XGBoost) and sentiment analysis (BERT via HuggingFace Transformers).

#### 4.1 Navigate to the ml-models folder

```bash
cd ml-models
```

#### 4.2 Create a virtual environment (recommended)

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

#### 4.3 Install Python dependencies

```bash
pip install -r requirements.txt
```

#### 4.4 Create a dummy model (quick start)

If you don't have session data yet, generate a dummy XGBoost model:

```bash
python create_dummy_model.py
```

This creates `xgboost_model.pkl` which the API needs to start.

#### 4.5 Train with real data (when sessions exist)

Once you have session data in the database, train a real model:

```bash
python train_model.py
```

> **Note:** Set the database environment variables (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) or they will default to localhost/cja/postgres/postgres.

#### 4.6 Start the ML API server

```bash
python run.py
```

The ML API will run at **http://localhost:8000**.

---

### 5. Running All Services Together (Manual)

You need **three terminals** running simultaneously:

| Terminal | Directory | Command |
|----------|-----------|---------|
| 1 | `backend/` | `npm run dev` |
| 2 | `frontend/` | `npm run dev` |
| 3 | `ml-models/` | `python run.py` |

---

## Standalone Tracker SDK Integration

The platform includes a drop-in standalone script at `tracking-script/tracker.js`.

Clients can integrate with a single snippet in their `<head>`:

```html
<script>window.CJA_CONFIG={site_id:"YOUR_SITE_ID",track_endpoint:"https://api.yourplatform.com/api/track",funnel:["/products","/cart","/checkout","/order-complete"],debug:false};</script>
<script src="https://cdn.yourplatform.com/tracker.js" async></script>
<!-- Paste both lines inside <head> -->
```

Required config keys:
- `site_id` (tenant identifier)
- `track_endpoint` (your backend `/api/track` URL)

The tracker captures page views, SPA route changes, clicks, scroll depth, mouse movement samples, and funnel stage events.

Hosting options for `tracker.js` (no build step required):
- Netlify static hosting
- S3 + CloudFront
- Express static file serving

---

## Project Structure

```
customer-journey-analytics/
+-- docker-compose.yml       # Docker Compose config (one-command startup)
+-- .env.example             # Environment variable template
+-- backend/                 # Express.js REST API
|   +-- Dockerfile
|   +-- config/              # Database configuration (uses env vars)
|   +-- middleware/           # Auth middleware (JWT)
|   +-- routes/              # API routes (auth, tracking, analytics)
|   +-- server.js            # Entry point
|   +-- setup_db.js          # Database table creation and admin seeding
|   +-- run_migration.js     # Idempotent DB migration for site_id columns/indexes
+-- frontend/                # React + Vite SPA
|   +-- Dockerfile
|   +-- public/              # Static assets and tracking script
|   +-- src/
|       +-- components/      # Reusable components
|       +-- context/         # Auth context provider
|       +-- pages/           # Application pages
+-- ml-models/               # FastAPI ML service
|   +-- Dockerfile
|   +-- requirements.txt     # Python dependencies
|   +-- app.py               # API endpoints (predict, sentiment)
|   +-- train_model.py       # Train XGBoost on real data
|   +-- create_dummy_model.py  # Generate dummy model for testing
|   +-- run.py               # Uvicorn launcher
+-- tracking-script/         # Standalone tracking SDK (tracker.js)
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_USER` | `postgres` | PostgreSQL username |
| `DB_PASSWORD` | `postgres` | PostgreSQL password |
| `DB_HOST` | `localhost` | Database host (`db` in Docker) |
| `DB_NAME` | `cja` | Database name |
| `DB_PORT` | `5432` | Database port |
| `PORT` | `5000` | Backend server port |
| `JWT_SECRET` | `cja_secret_key` | Secret key for JWT tokens |
| `ML_SERVICE_URL` | `http://localhost:8000` | ML API base URL (auto-set in Docker) |
| `ADMIN_EMAIL` | `admin@example.com` | Initial admin email |
| `ADMIN_PASSWORD` | `Admin123!` | Initial admin password |
| `ADMIN_USERNAME` | `admin` | Initial admin username |

---

## Troubleshooting

- **Database connection errors:** Ensure PostgreSQL is running and the credentials in `.env` are correct.
- **Port conflicts:** If port 5000, 5173, or 8000 is in use, update the respective config.
- **ML model not found:** Run `python create_dummy_model.py` to generate `xgboost_model.pkl` before starting the ML server.
- **BERT model download:** The first run of the ML server will download the BERT model from HuggingFace (~250 MB). Ensure internet access.
- **Docker issues:** Run `docker compose down -v` to reset everything, then start fresh with the setup steps.
