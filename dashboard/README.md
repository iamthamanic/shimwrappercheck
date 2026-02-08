# shimwrappercheck Dashboard

Next.js Web UI for shimwrappercheck: status, run checks, edit `.shimwrappercheckrc`, and edit **AGENTS.md**.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Quality checks

From the `dashboard` folder:

```bash
npm run check    # Prettier + TypeScript + ESLint
npm run lint     # ESLint only
npm run format   # Prettier write
npm run format:check  # Prettier check
```

Security: run `npm audit` and optionally `npx snyk test`. If Snyk reports a Next.js vulnerability, consider upgrading Next (see [Next.js upgrade guide](https://nextjs.org/docs/app/guides/upgrading)).

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
