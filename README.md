# WELLCARE

WELLCARE is a full-stack demonstration application for health information and care coordination. It includes a React/Vite web client, an Express REST API, and a MySQL relational schema.

> **Healthcare notice:** This is a demonstration project, not a medical device or a substitute for professional care. It does not provide diagnoses, prescriptions, ambulance dispatch, or guaranteed emergency response. Do not use real patient data until privacy, security, clinical, and legal reviews are complete.

## What is included

- Separate patient and doctor registration and login; bcrypt password hashing; JWT sessions; role-based APIs.
- Patient and doctor dashboards, patient IDs, doctor verification status, administrator verification, doctor search, availability slots, booking and cancellation.
- Transaction-locked appointment booking to prevent concurrent booking of the same slot.
- Patient health records, explicit record-sharing grants, nominees, notifications, and emergency contact request tracking.
- AI assistant adapter that requires a backend-only API key and returns an explicit unavailable response when not configured.
- OpenStreetMap/Nominatim hospital search; external data may be incomplete and is not an emergency availability feed.
- Configurable trusted medicine-information source plus a separate fictional, clearly labeled demo catalog covering the specialties present in the doctor directory; demo placeholders contain no drug guidance.
- Embedded Jitsi video calls for accepted appointments via `@jitsi/react-sdk`; public-server calls are demo-only.
- Responsive interface and a setup guide in [docs/setup.md](docs/setup.md).

## Quick start

Requirements: Node.js 20+ and MySQL 8+.

1. Create a MySQL database and application user. See [docs/setup.md](docs/setup.md).
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and a random `JWT_SECRET` of at least 32 characters.
3. Import `database/schema.sql` into MySQL.
4. From this directory, run `npm install`, then `npm run dev`.
5. Open `http://localhost:5173`.

Doctor accounts start pending. To use the admin tools locally, create an administrator account manually as described in the setup guide. Do not leave demo admin credentials in a deployed environment.

## Project layout

```text
frontend/       React + Vite application
backend/        Express REST API and integration adapters
database/       MySQL schema
docs/           Setup, architecture, API, integration, and security notes
```

## Configuration

Configuration is read from the root `.env` file. Never commit it. Optional providers are deliberately disabled until configured. The app displays service errors rather than fake results.

### Local AI assistant setup (Ollama)

The patient dashboard uses Ollama locally by default. The backend calls Ollama at `http://127.0.0.1:11434/v1` with model `qwen3:8b`; the local compatibility API ignores the placeholder `LLM_API_KEY=ollama`. Ensure Ollama is running and the model is installed (`ollama run qwen3:8b` downloads it if needed), then restart the backend after editing the root `.env`. Chat prompts go to the configured local Ollama server. Do not expose port 11434 publicly. For a hosted OpenAI-compatible provider, change all three `LLM_*` settings and review its privacy and data-processing terms before sending health information.

Example placeholders only:

```env
LLM_API_KEY=your-provider-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

## Current limitations

This is an initial integrated demonstration, not a production healthcare platform. Prescription creation and PDF export are available, but the PDF is not a legally verified digital signature. Document workflows, email/SMS delivery, password reset, doctor reviews, and secure Jitsi authentication still have limitations or require provider setup. See [docs/known-limitations.md](docs/known-limitations.md).

## Build

```bash
npm run build
```

## Tests

Run the dependency-free unit tests with `npm test`. To include the read-only live API and database smoke checks, start WELLCARE first and set a local approved doctor account in your VS Code PowerShell terminal:

```powershell
$env:WELLCARE_TEST_API_URL = 'http://localhost:4000'
$env:WELLCARE_TEST_EMAIL = 'your-approved-demo-doctor@example.test'
$env:WELLCARE_TEST_PASSWORD = 'your-local-test-password'
npm test
Remove-Item Env:WELLCARE_TEST_API_URL, Env:WELLCARE_TEST_EMAIL, Env:WELLCARE_TEST_PASSWORD
```

The integration checks validate API health, JSON boundary errors, CORS, authentication/authorization, doctor visibility, the demo catalog, prescription response shape, and schema tables. They avoid creating or deleting database records. Keep test credentials out of source control.

For local API health, open `http://localhost:4000/api/health`. The endpoint reports database connectivity and does not expose credentials.

## LOCAL DATABASE SETUP AND TROUBLESHOOTING

WELLCARE uses MySQL 8+ through the `mysql2` driver. Install MySQL Server (or use a compatible managed MySQL instance) and ensure it is running and reachable on the host and port in `DATABASE_URL` (the local default is port `3306`). The frontend does not connect directly to MySQL; only the Express backend reads the root `.env` file.

In the VS Code terminal at the project root, create the local environment file and edit it:

```powershell
Copy-Item .env.example .env
```

Set `DATABASE_URL=mysql://wellcare:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:3306/wellcare` and a unique `JWT_SECRET` of at least 32 characters. URL-encode special characters in the password. `.env` is ignored by Git; never put these values in frontend environment variables.

Create the database and local runtime user in MySQL (choose your own password):

```sql
CREATE DATABASE IF NOT EXISTS wellcare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'wellcare'@'localhost' IDENTIFIED BY 'choose-a-local-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON wellcare.* TO 'wellcare'@'localhost';
```

Import the repeatable schema with an administrative MySQL account; the `CREATE TABLE IF NOT EXISTS` statements preserve existing rows and tables:

```powershell
Get-Content .\database\schema.sql | mysql -u root -p
```

There is no migration runner in this project: `database/migrations/001_initial_schema.sql` is the initial SQL migration, and `database/migrations/002_prescription_patient_weight.sql` safely adds the optional prescription weight field to an existing database. For a fresh database, import `database/schema.sql` as above; apply later reviewed forward-only SQL migrations using a database administrator account. Do not re-create or drop an existing database to resolve a connection error.

Then install and start both servers:

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`; check `http://localhost:4000/api/health` for a real connection check. Start only the backend with `npm run dev:backend`, or the frontend with `npm run dev:frontend`. Registration and login use the MySQL `users` and role profile tables; passwords are stored as bcrypt hashes, and sessions use signed JWTs (there is no server-side session table).

Troubleshooting:

- `DATABASE_URL is required` or `JWT_SECRET must be configured`: copy `.env.example` to the project root as `.env`, fill both values, and restart the backend.
- `MySQL is unavailable`: start the MySQL service, then verify the hostname and port in `DATABASE_URL`.
- MySQL rejects credentials: check the username/password and URL-encode password characters such as `@`, `:`, `/`, `#`, or `%`.
- Database not found: create `wellcare` and import `database/schema.sql`.
- API unreachable in the browser: keep both servers running and check port `4000`. If Vite moved from `5173` to another local port because `5173` was occupied, development mode allows localhost origins; restart the backend after changing `CLIENT_ORIGIN` or `VITE_API_URL`. Production must set `NODE_ENV=production` and an explicit comma-separated `CLIENT_ORIGIN` allowlist.
- The API logs detailed driver error codes locally; HTTP responses avoid returning connection strings, passwords, or server details.

### Demo doctor profiles

To populate the doctor directory with fictional sample profiles, run `database/seed_demo_doctors.sql` in MySQL Workbench or from the local MySQL client. It adds 12 profiles and is safe to rerun. The first five have demo-approved status and three rolling appointment slots each; the remaining seven are disabled. The first five use the local-only demo password `WellcareDemo!2026`. Their names, qualifications, and approval flags are fictional; no real clinician documents were reviewed. Never use these accounts in production.
