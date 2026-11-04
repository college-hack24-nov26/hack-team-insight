# Known limitations and delivery checklist

## Implemented in this demonstration

- React/Vite application, responsive patient interface, doctor portal, and admin verification view.
- Patient/doctor registration, login, role claims, bcrypt hashes, and JWT-authenticated APIs.
- MySQL schema and appointment slot transaction/locking workflow.
- Doctor availability, verified doctor search, patient-created records, consent grants, nominees, in-app notifications, and emergency request capture.
- Backend AI adapter with a safety prompt and local Ollama support; OpenStreetMap hospital lookup; configurable medicine source and clearly fictional, non-clinical demo medicine placeholders; embedded appointment-scoped Jitsi calls.
- Doctor-authored prescriptions with patient demographics, multiple medicine rows, stored optional weight, and downloadable PDF export; exported PDFs are not digitally certified or legally verified signatures.

## Not yet implemented

- Doctor certificate/identity file uploads, private admin document viewer endpoint, and verification decisions are implemented. The admin screen does not yet show the document review links. Malware scanning is not included.
- A patient report upload API is present, but the dashboard does not yet expose the report upload/download flow.
- Email/SMS delivery, appointment reminders, and delivery status.
- Password recovery flow and refresh-token/revocation mechanism.
- Real secure video authentication; current Jitsi link is a demo integration and is not suitable for confidential care.
- Doctor reviews can be submitted after completed appointments and moderated through admin APIs; the admin moderation screen and public review list are not implemented.
- Full admin user and emergency monitoring tools.
- Medicine API response normalization/verification.
- Emergency/ambulance dispatch provider. Current SOS is only a recorded contact workflow.
- Formal test suite and deployment automation.
- Patient profile editing and password recovery.
- Nominee editing and external email/SMS delivery.
- Dashboard integration of map tiles, location-based distance, and geolocation search (city search and map links are available).

## Completion status

This is a working initial demonstration for the implemented paths, not the full production scope in the master brief. Provider-backed features require provider accounts/configuration. Real clinical use requires substantial security, privacy, legal, and clinical work.
