# Today Care — Diabetes Care AI

A web application and Capacitor-based Android app for logging blood glucose readings, managing meal reminders, chatting with a Gemini-powered assistant, and reviewing information through an administrator dashboard.

> This is a health-support software project. AI-generated responses are not a substitute for professional medical advice, diagnosis, or treatment.

## Features

- Registration and login using session cookies.
- Blood glucose logging and history views.
- A Gemini AI assistant that can use the user's health context.
- Meal reminders, Web Push, and Android local notifications.
- Reports and frequently asked topics.
- An admin panel for statistics, users, data logs, knowledge content, and AI-response evaluation.

## Tech stack

| Layer | Technologies |
|---|---|
| User frontend | React, Vite, Tailwind CSS, Recharts |
| Admin frontend | React, Vite, Recharts |
| Backend | Node.js, Express |
| Database | Supabase PostgreSQL |
| AI | Google Gemini through the Google Gen AI SDK |
| Android | Capacitor and local notification plugins |
| Notifications | Web Push and Android local notifications |

## Repository structure

| Directory | Purpose |
|---|---|
| `frontend/` | User-facing React and Vite application |
| `admin-panel/` | React and Vite administrator interface |
| `backend/` | Express API, business logic, database access, and evaluation tools |
| `android/` | Capacitor-generated Android shell |
| `docs/` | System, development, and deployment documentation |

## Run locally

Install dependencies from the repository root:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix admin-panel install
```

Copy `backend/.env.example` to `backend/.env` and supply the required settings for your own test environment. Review the frontend/admin environment examples as well; the user frontend uses `VITE_API_URL`.

Start the API:

```bash
npm run dev:backend
```

In another terminal, start the user frontend:

```bash
npm run dev:frontend
```

- User frontend: `http://localhost:5173`
- API health check: `http://localhost:5000/api/health`

To run the admin interface separately:

```bash
npm --prefix admin-panel run dev
```

## Android workflow

The project includes a Capacitor Android shell. With the required Android development tools installed:

```bash
npm run build:app
npm run android:open
```

See the [Android build guide](docs/ANDROID_APP_BUILD.md) for environment-specific setup.

## Documentation

- [System architecture](docs/SYSTEM_ARCHITECTURE.md)
- [API reference](docs/API_DOCUMENTATION.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Setup and configuration](docs/SETUP_CONFIGURATION.md)
- [Code standards](docs/CODE_STANDARDS.md)
- [Known issues and roadmap](docs/KNOWN_ISSUES_AND_ROADMAP.md)
- [Source code guide](docs/SOURCE_CODE_GUIDE.md)
- [Dataset and evaluation guide](docs/DATASET_GUIDE.md)
- [Libraries and dependencies](docs/LIBRARIES_AND_DEPENDENCIES.md)
- [Development workflow](docs/DEVELOPMENT_WORKFLOW.md)
- [Deploying the backend to Railway](docs/RAILWAY_BACKEND_DEPLOY.md)
- [Deploying the frontend to Vercel](docs/VERCEL_DEPLOY.md)

## Deployment and configuration

The documented deployment architecture uses Vercel for the frontend, Railway for the backend, and Supabase PostgreSQL for the database. AI and notification capabilities require their corresponding provider configuration.

Keep database credentials, AI API keys, notification secrets, and populated `.env` files outside Git. Use isolated test data when demonstrating health-related features.
