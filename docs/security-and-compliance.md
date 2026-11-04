# Security and compliance notes

This demonstration implementation includes password hashing, role checks, parameterized SQL through mysql2, schema validation, a narrow CORS origin, Helmet headers, auth rate limiting, protected health-record APIs, and explicit record-access grants.

Before using real patient information, obtain a jurisdiction-specific legal/privacy review and complete a threat model, independent security assessment, encryption-at-rest and key-management plan, tested backups/recovery plan, retention/deletion and access-log policies, incident response, vendor reviews, consent and notice flows, and operational access controls. The brief references India; applicable laws and health-sector obligations must be verified by qualified counsel at the time and in the locations of deployment.

Known gaps include in-memory/browser token persistence, no token revocation, no password reset, no MFA, no file upload malware scanning, incomplete audit coverage, no data export/deletion workflow, no encryption layer for selected sensitive fields, and no formal security or clinical validation. Do not enter real health data.
