# API outline

Base path: `/api/v1`. JSON requests and responses. Authenticated calls use `Authorization: Bearer <JWT>`. Error format: `{ "error": "..." }`, with validation detail where appropriate.

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/auth/register/patient` | Public | Register patient |
| POST | `/auth/register/doctor` | Public | Register unverified doctor |
| POST | `/auth/login` | Public | Sign in |
| POST | `/auth/logout` | Authenticated | Sign out client session |
| GET | `/auth/me` | Authenticated | Current identity |
| GET | `/dashboard` | Authenticated | Role-specific dashboard data |
| GET | `/doctors?search=` | Authenticated | Search approved doctors |
| GET | `/doctors/:publicId/availability` | Authenticated | List upcoming slots |
| POST | `/doctors/me/availability` | Approved doctor | Publish time slot |
| POST | `/appointments` | Patient | Request a slot |
| GET | `/appointments` | Patient/doctor | Own appointment list |
| PATCH | `/appointments/:id/status` | Doctor | Accept, reject, or complete request |
| POST | `/appointments/:id/cancel` | Patient | Cancel own appointment |
| POST | `/appointments/:id/review` | Patient | Review completed appointment (admin moderation required) |
| GET/POST | `/records` | Patient | List or add personal records |
| GET | `/record-access-grants` | Patient | List own doctor-sharing grants and revocation state |
| POST | `/record-access-grants` | Patient | Consent to doctor record access |
| DELETE | `/record-access-grants/:id` | Patient | Revoke an active patient-owned grant |
| GET | `/records/patient/:publicId` | Doctor | Read records with consent/treatment context |
| POST | `/emergency/requests` | Patient | Record priority/SOS contact request |
| GET/POST/DELETE | `/nominees` | Patient | Manage nominees |
| GET | `/notifications` | Authenticated | List in-app notifications |
| POST | `/chat` | Authenticated | Send a general-health question |
| GET | `/chat/:conversationId` | Conversation owner | Read conversation history |
| GET | `/hospitals/search?location=` | Authenticated | OpenStreetMap hospital search |
| GET | `/medicines/demo-catalog` | Authenticated | Fictional, non-clinical placeholders for specialties currently in the doctor directory |
| GET | `/medicines/search?q=` | Authenticated | Query configured medicine source |
| GET | `/consultations/:appointmentId/join` | Appointment participants | Get configured video room link |
| GET | `/admin/doctors/pending` | Admin | List pending doctors |
| PATCH | `/admin/doctors/:publicId/verification` | Admin | Approve/reject doctor |
| GET | `/admin/doctors/:publicId/documents/:documentId` | Admin | Read private verification document |
| GET | `/admin/reviews/pending` | Admin | List reviews awaiting moderation |
| PATCH | `/admin/reviews/:id/moderation` | Admin | Set review visible/hidden |

Authentication logout currently instructs the client to clear its token; there is no server-side token revocation list. Password reset and several planned module endpoints are not implemented yet; see `known-limitations.md`.
