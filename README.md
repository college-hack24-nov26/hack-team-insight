# Hack Team Insight

## WELLCARE registration page

This repository includes a standalone, responsive registration page at [`registration.html`](registration.html). It supports patient and doctor registration and sends submissions to the WELLCARE API; it does not include or modify the API or database.

To preview it from the VS Code integrated terminal, run this in the repository root:

```powershell
py -m http.server 5173
```

Then open `http://localhost:5173/registration.html`. The page uses `http://localhost:4000/api/v1` by default, checks API/MySQL health, and lets you change the API base URL under **API connection settings**. The backend must allow the page origin in `CLIENT_ORIGIN`.

Doctor applications are submitted for review. The page reports API validation and connectivity errors and does not contain credentials or API keys.
