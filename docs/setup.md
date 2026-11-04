# WELLCARE setup guide

## 1. Install prerequisites

- Node.js 20 or newer with npm.
- MySQL 8 or compatible managed MySQL service.
- VS Code (optional but recommended for editing and running the project).

## 2. Open in VS Code

Open the `outputs/wellcare` folder in VS Code. In the integrated terminal, run commands from that folder. The project uses npm workspaces; install dependencies once at the root.

## 3. Create the database

Create a database and a least-privilege local development user in MySQL. Example SQL (change the password before use):

```sql
CREATE DATABASE IF NOT EXISTS wellcare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'wellcare'@'localhost' IDENTIFIED BY 'replace-this-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON wellcare.* TO 'wellcare'@'localhost';
```

Import `database/schema.sql` using an administrative MySQL account for the first schema setup. The runtime `wellcare` account only needs the data access grants shown above; do not grant it schema changes. The schema's `CREATE DATABASE IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` statements are safe to re-run and preserve existing records.

For an existing installation, apply forward-only migrations with an administrative account. The prescription weight field migration is repeatable:

```powershell
Get-Content .\database\migrations\002_prescription_patient_weight.sql | mysql -u root -p
```

## 4. Configure environment variables

In the VS Code integrated terminal, copy `.env.example` to `.env` and update at least:

```dotenv
DATABASE_URL=mysql://wellcare:replace-this-password@localhost:3306/wellcare
JWT_SECRET=use-a-random-secret-at-least-32-characters-long
CLIENT_ORIGIN=http://localhost:5173
```

PowerShell copy command: `Copy-Item .env.example .env`. Generate a secret with Node: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

Use URL encoding for special characters in the database password. Keep `.env` local and never commit it. Local Ollama and the demo Jitsi host are configured separately through `LLM_*` and `JITSI_DOMAIN` settings.

## 5. Install and run

In the VS Code integrated terminal, from the project root:

```bash
npm install
npm run dev
```

The web app runs at `http://localhost:5173`; the API runs at `http://localhost:4000`. Visit `http://localhost:4000/api/health` to check API/database availability.

Production frontend build:

```bash
npm run build
```

Run the production API with `npm start` after setting production environment variables and applying the schema.

## 6. Create a local administrator

There is no public admin signup. Register a patient account through the UI, then set its role for local administration with a direct database update:

```sql
UPDATE users SET role='admin' WHERE email='your-local-admin@example.test';
```

Sign out and back in so the new role is reflected in the JWT. Use a dedicated account and remove or disable this access before deployment. Never expose the database or this operation through the public API.

## 7. External provider configuration

- **AI:** Set `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL` for a compatible chat-completions provider. Requests are sent from the backend. Review provider retention/data-processing terms before sending any personal health information.
- **Video:** For an accepted appointment, Join consultation opens the embedded Jitsi room directly and uses the signed-in user's name; the separate device/name pre-join screen is skipped. The first participant in a new `meet.jit.si` room may still need to authenticate or wait for a moderator, as required by that public service. To avoid that provider login, configure a Jitsi host with guest access or an authenticated JaaS/Jitsi JWT setup; the project cannot manufacture provider credentials. Public rooms are not suitable for confidential care; configure a secured deployment before real consultations.
- **Hospitals:** Search uses OpenStreetMap Nominatim, with attribution in the UI. Respect the service's usage policy and do not use it as an emergency dispatch or availability source.
- **Medicines:** Set `MEDICINE_API_URL` to an approved provider endpoint accepting a `q` query parameter. Verify data terms, source reliability, and response format before enabling it.
- **Email/SMS:** SMTP variables are reserved for a future notification-delivery implementation. This version only stores in-app notifications; it does not send messages externally.
- **Ambulance:** No dispatch provider is connected. Emergency help clearly asks users to contact their local emergency services.

## 8. Troubleshooting

- `JWT_SECRET must be configured`: add a random secret of at least 32 characters to `.env` and restart the API.
- API reports database unavailable: verify MySQL is running, credentials are correct, and `database/schema.sql` was imported.
- Browser cannot reach the API: check both dev processes and port 4000. Vite may select port `5174` when `5173` is already occupied; the API allows local HTTP origins on any port during development. For deployment, set `NODE_ENV=production` and list the exact frontend origin(s) in `CLIENT_ORIGIN`.
- Doctor search is empty: only administrator-approved doctors are listed; new doctor registrations start pending.
- AI or medicine lookup says not configured: add the relevant provider configuration; the app intentionally does not show invented data.

## 9. Optional demo doctor profiles

For a populated doctor directory during a demo, run `database/seed_demo_doctors.sql` against the local `wellcare` database. It is repeatable and creates 12 fictional specialty profiles. The first five have demo-approved status and three rolling appointment slots each; the other seven remain disabled and pending. The five ready accounts share the local-only password `WellcareDemo!2026`; use their `demo.wellcare.local` email addresses shown in the seed file. These approval flags and qualifications are fictional demo data, not real document checks or verified clinicians. Never deploy these accounts or represent them as real medical professionals.
