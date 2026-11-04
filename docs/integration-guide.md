# Integration guide

## LLM assistant

The default local provider is Ollama using its OpenAI-compatible chat completions endpoint. Configure the root `.env` with `LLM_API_KEY=ollama`, `LLM_BASE_URL=http://127.0.0.1:11434/v1`, and `LLM_MODEL=qwen3:8b`; Ollama ignores the placeholder key. Start Ollama and make sure the model is installed (`ollama run qwen3:8b`), then restart the backend. The API sends a system instruction limiting responses to general health information and warning about emergencies. Chat prompts remain on the configured Ollama host. Do not expose the unauthenticated local Ollama port to the network. Alternative hosted OpenAI-compatible providers can use the same settings, but their real API keys must remain in the backend root `.env`; review privacy and data-processing terms first. Before production, add explicit user notice/consent, stronger medical safety evaluation, redaction policy, and abuse monitoring.

## Video consultation

Accepted appointments embed Jitsi Meet using `@jitsi/react-sdk`. The authenticated backend issues room details only after verifying the requester is the appointment's patient or doctor. The embedded client skips Jitsi's pre-join screen and supplies the signed-in WELLCARE name. `JITSI_DOMAIN` defaults to `meet.jit.si` for local demos; its public service may still require its first room participant to authenticate or wait for a moderator. The public demo service does not mint Jitsi JWTs or prevent access by someone who obtains a room URL; the UI warns users not to discuss real or sensitive patient information. For no-provider-login access and real consultations, configure guest access on a secured Jitsi deployment or an authenticated JaaS/Jitsi JWT setup, plus room expiry, deployment hardening, and clinical operational procedures.

## Hospital search

Search is performed through Nominatim and displays mapped results. It is not a hospital directory service-level guarantee. Respect attribution and usage policies; add a paid or self-hosted geocoding/search provider if usage requires it.

## Medicine information

Set `MEDICINE_API_URL` to an organization-approved endpoint that supports a `q` query parameter and returns JSON. Confirm source reliability, licensing, regional product naming, warnings, and response mapping before enabling. Search results must be informational and should not advise users to self-medicate.

## Email and SMS

Database notification records are supported. Outbound email/SMS is not yet implemented. SMTP variables are placeholders only; do not describe message delivery as active until a provider adapter and delivery-status handling are implemented.

## Ambulance / emergency dispatch

No dispatch provider is integrated. SOS records the user's request and optionally permitted location, but it does not contact responders. Keep local emergency service guidance prominent and configure jurisdiction-specific contact information before any demonstration outside a controlled setting.
