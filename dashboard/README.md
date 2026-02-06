# shimwrappercheck Dashboard

Next.js Web UI for shimwrappercheck: status, run checks, edit `.shimwrappercheckrc`, and edit **AGENTS.md**.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy (e.g. Vercel)

- Set **Root Directory** to `dashboard` (or deploy from repo root and build from `dashboard`).
- Set env **SHIM_PROJECT_ROOT** to the absolute path of the repo where `.shimwrappercheckrc` and `AGENTS.md` live (required when dashboard runs in a different directory than the project).

## Pages

- **Dashboard**: Status (config, AGENTS.md, run-checks script, hooks), button "Nur Checks ausführen", links to Config and AGENTS.md.
- **Config**: Edit `.shimwrappercheckrc` (raw text).
- **AGENTS.md**: Edit agent instructions; used by Cursor/Codex. Editable by agents and humans via this UI.

## API

- `GET /api/status` – project status (paths, existence of config/AGENTS.md/scripts/hooks).
- `GET/POST /api/config` – read/write `.shimwrappercheckrc`.
- `GET/POST /api/agents-md` – read/write `AGENTS.md` (default content if missing).
- `POST /api/run-checks` – run `scripts/run-checks.sh`, return stdout/stderr/code.

All paths resolve from **project root** (parent of `dashboard/` when running locally, or `SHIM_PROJECT_ROOT` when set).
