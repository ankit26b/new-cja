# Customer Journey Analytics (CJA)

A full-stack application for tracking and analyzing user journeys across a website. It includes a **React frontend**, **Node.js/Express backend**, **PostgreSQL database**, and an **ML service** (FastAPI + XGBoost + BERT) for drop-off prediction and sentiment analysis.

---

## Prerequisites

Make sure the following are installed on your machine:

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | v18+ | https://nodejs.org |
| **npm** | comes with Node.js | — |
| **PostgreSQL** | v14+ | https://www.postgresql.org/download |
| **Python** | 3.9+ | https://www.python.org/downloads |
| **Git** | any recent version | https://git-scm.com |

---

## 1. Clone the Repository

```bash
git clone <repository-url>
cd customer-journey-analytics
```

---

## 2. Backend Setup

### 2.1 Install dependencies

```bash
cd backend
npm install
```

### 2.2 Configure environment variables

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

# Admin Seed (used by setup_db.js — remove or leave blank after first run)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin123!
ADMIN_USERNAME=admin
```

> **Note:** Update `DB_PASSWORD` with your actual PostgreSQL password.

### 2.3 Create the PostgreSQL database

Open a terminal or `psql` and create the database:

```sql
CREATE DATABASE cja;
```

### 2.4 Run database setup (create tables & seed admin)

```bash
node setup_db.js
```

This will create the `users`, `sessions`, and `events` tables, and seed an admin user if one doesn't exist.

### 2.5 Update `config/db.js` (if needed)

The file `backend/config/db.js` has hardcoded credentials. Update the `password` field to match your PostgreSQL password:

```javascript
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'cja',
    password: 'your_postgres_password',  // <-- update this
    port: 5432,
});
```

### 2.6 Start the backend server

```bash
# Development (auto-restart on changes)
npm run dev

# OR Production
npm start
```

The backend will run at **http://localhost:5000**.

---

## 3. Frontend Setup

### 3.1 Install dependencies

```bash
cd frontend
npm install
```

### 3.2 Start the development server

```bash
npm run dev
```

The frontend will run at **http://localhost:5173** (default Vite port).

---

## 4. ML Models Setup (Optional)

The ML service provides drop-off prediction (XGBoost) and sentiment analysis (BERT via HuggingFace Transformers).

### 4.1 Navigate to the ml-models folder

```bash
cd ml-models
```

### 4.2 Create a virtual environment (recommended)

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 4.3 Install Python dependencies

```bash
pip install fastapi uvicorn joblib numpy xgboost scikit-learn transformers torch psycopg2-binary pandas
```

### 4.4 Create a dummy model (quick start)

If you don't have session data yet, generate a dummy XGBoost model:

```bash
python create_dummy_model.py
```

This creates `xgboost_model.pkl` which the API needs to start.

### 4.5 Train with real data (when sessions exist)

Once you have session data in the database, train a real model:

```bash
python train_model.py
```

> **Note:** Update the database credentials in `train_model.py` to match your setup before running.

### 4.6 Start the ML API server

```bash
python run.py
```

The ML API will run at **http://localhost:8000**.

---

## 5. Running All Services Together

You need **three terminals** running simultaneously:

| Terminal | Directory | Command |
|----------|-----------|---------|
| 1 | `backend/` | `npm run dev` |
| 2 | `frontend/` | `npm run dev` |
| 3 | `ml-models/` | `python run.py` |

---

## Project Structure

```
customer-journey-analytics/
├── backend/             # Express.js REST API
│   ├── config/          # Database configuration
│   ├── middleware/       # Auth middleware (JWT)
│   ├── routes/          # API routes (auth, tracking, analytics)
│   ├── server.js        # Entry point
│   ├── setup_db.js      # Database table creation & admin seeding
│   └── .env             # Environment variables (create manually)
├── frontend/            # React + Vite SPA
│   ├── public/          # Static assets & tracking script
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── context/     # Auth context provider
│   │   └── pages/       # Application pages
│   └── vite.config.js
├── ml-models/           # FastAPI ML service
│   ├── app.py           # API endpoints (predict, sentiment)
│   ├── train_model.py   # Train XGBoost on real data
│   ├── create_dummy_model.py  # Generate dummy model for testing
│   └── run.py           # Uvicorn launcher
└── tracking-script/     # Standalone tracking JS snippet
```

---

## Default Credentials

After running `setup_db.js`, the following admin account is created:

| Field | Value |
|-------|-------|
| Email | `admin@example.com` |
| Password | `Admin123!` |

> Change these in the `.env` file before running `setup_db.js` if you want different credentials.

---

## Troubleshooting

- **Database connection errors:** Ensure PostgreSQL is running and the credentials in `.env` and `config/db.js` match.
- **Port conflicts:** If port 5000, 5173, or 8000 is in use, update the respective config files.
- **ML model not found:** Run `python create_dummy_model.py` to generate `xgboost_model.pkl` before starting the ML server.
- **BERT model download:** The first run of the ML server will download the BERT model from HuggingFace (~250 MB). Ensure you have internet access.