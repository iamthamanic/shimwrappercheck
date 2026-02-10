# Workflow & Gap Analysis (no code changes yet)

This doc describes the **desired workflow**, what **already exists**, and what **still needs to be done**. No code has been changed; this is the plan for when you "come in the door" next.

---

## 1. Desired workflow (your description)

### First-time setup: one CLI command + wizard

- User runs **one CLI command** that sets up the whole shimwrapper.
- A **wizard** runs with questions like:
  - "Do you want this? Do you want that?"
  - Prettier, Lint, snake/processes, authentication where needed
  - AI review → "You need to log in to Codex" (or Cursor)
  - etc.
- User **confirms** what they want; everything is configured from that.

### Later: change things via GUI

- User clicks a **link** (e.g. from CLI output or README) → **graphical surface (dashboard)** opens.
- In the dashboard:
  - **On/off toggles** per check (e.g. "Don’t run this check").
  - **Grouping**: e.g. "Supabase pushes/deploys" vs "GitHub pushes/deploys".
  - **Which commands** run checks/hooks – configurable, with sensible defaults.

### Presets

- **Default preset: "Vibe Code"**
  - Includes: **GitHub** (Git) + **Supabase**, with all relevant commands.
  - User can select this preset and then tweak individual categories/commands.
- **Custom presets**
  - User can **create new presets** (e.g. "Create new preset").
  - **Drag & drop** providers into a preset (e.g. drag "GitHub" into the new preset).
  - When opening a preset (e.g. "GitHub"), all commands for that provider are listed and can be **toggled on/off**.
- Presets are the main way to say "which commands" (Supabase vs Git vs both, and which subcommands).

### Summary of desired UX

| When       | What                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| First time | One CLI → wizard → "Want this? Want that?" (Prettier, Lint, AI review, auth hints, etc.) → confirm → full setup              |
| Later      | Open dashboard via link → toggles per check, groups (Supabase vs GitHub), presets (Vibe Code default, custom by drag & drop) |
| Presets    | Vibe Code = GitHub + Supabase, all commands; custom presets = drag provider in, then toggle commands                         |

---

## 2. What we already have

### CLI

| Piece                                       | Status | Notes                                                                                                                                                                                                         |
| ------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single entry**                            | ✅     | `npx shimwrappercheck init` sets up shim + config + hooks.                                                                                                                                                    |
| **Wizard (init)**                           | ✅     | Asks: Supabase shim? Git wrapper? Which commands for checks/hooks? AI review? Codex/Cursor login? run-checks.sh / ai-code-review.sh / Husky or git pre-push.                                                  |
| **Not a single "setup everything" command** | ⚠️     | User must first `npm i -D shimwrappercheck`, then `npx shimwrappercheck init`. So "one command" could mean: one command that does install + init (e.g. `npx shimwrappercheck setup` or `create-shimwrapper`). |
| **Prettier / Lint / snake in wizard**       | ❌     | Init does **not** ask "Do you want Prettier? Lint? Snake?" – it only asks for run-checks.sh template (which already contains lint/build/test). So no explicit Prettier/Lint/snake toggles in the wizard.      |
| **Auth hints**                              | ✅     | Init offers "log in to Codex" / "Cursor agent login" if AI review is enabled.                                                                                                                                 |
| **install**                                 | ✅     | `npx shimwrappercheck install` drops PATH shims (supabase, git, shim).                                                                                                                                        |

### Config (today)

- **.shimwrappercheckrc**: key=value (SHIM_ENFORCE_COMMANDS, SHIM_HOOK_COMMANDS, SHIM_GIT_ENFORCE_COMMANDS, SHIM_AUTO_PUSH, SHIM_CHECKS_ARGS, etc.).
- **No presets**: no concept of "Vibe Code" or "custom preset" in config.
- **No per-check toggles in config**: run-checks.sh has --frontend, --backend, --no-ai-review; config only has SHIM_CHECKS_ARGS (e.g. "--no-ai-review"). So "disable this check" = pass args, not a structured list of enabled checks.

### Dashboard (today)

| Feature                           | Status | Notes                                                                                                                                                             |
| --------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Open via link**                 | ✅     | User can run dashboard locally and open in browser; README has the link. No "open dashboard" link printed by CLI after init (could be added).                     |
| **Status**                        | ✅     | Shows: config exists, AGENTS.md, run-checks script, Husky, Git hook, Supabase.                                                                                    |
| **Run checks**                    | ✅     | Button "Nur Checks ausführen".                                                                                                                                    |
| **Edit .shimwrappercheckrc**      | ✅     | Config page = raw text editor.                                                                                                                                    |
| **Edit AGENTS.md**                | ✅     | Agents page = raw text editor.                                                                                                                                    |
| **On/off toggles per check**      | ❌     | No UI to enable/disable individual checks (e.g. "run lint", "run AI review").                                                                                     |
| **Grouping (Supabase vs GitHub)** | ❌     | No UI grouping "Supabase commands" vs "Git commands".                                                                                                             |
| **Presets**                       | ❌     | No presets (Vibe Code, custom), no drag & drop.                                                                                                                   |
| **"Which commands" per provider** | ❌     | No UI to select which Supabase commands (functions, db, migration, …) or Git commands (push, commit, …) run checks/hooks; that’s only in raw .shimwrappercheckrc. |

### Run-checks and checks

- **run-checks.sh**: frontend (lint, check:mock-data, build, test, npm audit, optional Snyk), backend (deno fmt/lint/audit), AI review (Codex/Cursor). No explicit "Prettier" step in template (lint covers style in many setups); no "snake" as a separate step.
- So: **Prettier / Lint / snake** in the wizard would mean either extending the wizard to ask for them and/or extending run-checks.sh (or a config that run-checks.sh reads) to turn steps on/off.

---

## 3. What it should look like (target)

### First-time flow

1. **One command** (e.g. `npx shimwrappercheck setup` or similar):
   - Ensures package is present (install if needed).
   - Runs wizard.
2. **Wizard** (can stay in init, or be invoked by setup):
   - "Do you want Supabase shim? Git (GitHub) wrapper?"
   - "Do you want Prettier / Lint / (snake?) in checks?" (or: "Use default checks (lint, build, test, optional AI review)?")
   - "Do you want AI review? → You’ll need to log in to Codex (or Cursor)." → offer login.
   - Create run-checks.sh, ai-code-review.sh, hooks, package.json scripts, .shimwrappercheckrc.
   - At the end: "To change options later, open the dashboard: [link]."

### Dashboard (target)

1. **Presets**
   - **Default: "Vibe Code"** – GitHub + Supabase, all commands (Supabase: functions, db, migration, …; Git: push, …). User can select this and then refine.
   - **Custom presets**: "Create new preset" → name → **drag & drop** providers (e.g. "GitHub", "Supabase") into the preset. When a provider is in the preset, show its commands with toggles.
   - Preset selection (dropdown or cards): e.g. "Vibe Code" | "My Preset" | "+ New preset".

2. **Grouping**
   - **Supabase** section: list of commands (functions deploy, db push, migration, …) with **on/off** for "run checks" and "run hooks" (or one toggle per command that means "enforce checks for this command").
   - **GitHub (Git)** section: list of commands (push, commit, merge, rebase, …) with on/off for "run checks".

3. **Checks**
   - **On/off toggles** for checks that run inside run-checks.sh (or equivalent):
   - e.g. Lint, Prettier, Build, Test, npm audit, Snyk, Backend (deno fmt/lint/audit), AI review.
   - Optional: "Authentication: Codex / Cursor" with hint "Run `codex login` or `agent login` if not done."

4. **Link from CLI**
   - After init/setup: print "Dashboard: http://localhost:3000 (run from dashboard/: npm run dev)" or a stable URL if deployed.

### Data model (for presets and toggles)

- **Current**: .shimwrappercheckrc (flat key=value).
- **Target** (conceptual):
  - **Presets**: list of presets; each preset has a name and a set of "providers" (Supabase, Git) and per-provider "commands" (which subcommands get checks/hooks).
  - **Active preset** or "current config" derived from one preset + overrides.
  - **Checks**: list of check types (lint, prettier, build, test, ai-review, …) with on/off. This could stay in .shimwrappercheckrc as new keys (e.g. SHIM_CHECK_LINT=1, SHIM_CHECK_AI_REVIEW=1) or a small JSON that run-checks.sh or the shim reads.

So we need:

- A way to **store presets** (e.g. JSON in repo or in .shimwrappercheckrc include, or a new file like `.shimwrappercheck-presets.json`).
- A way to **map preset + toggles** to existing env vars (SHIM_ENFORCE_COMMANDS, SHIM_HOOK_COMMANDS, SHIM_GIT_ENFORCE_COMMANDS, SHIM_CHECKS_ARGS) so the existing bins don’t need a full rewrite.

---

## 4. What still has to be done (concise)

| #   | Area                                | To do                                                                                                                                                                              |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **CLI: single entry**               | Add a single command (e.g. `npx shimwrappercheck setup`) that installs package if needed and runs init wizard.                                                                     |
| 2   | **Wizard: Prettier / Lint / snake** | Extend init (or setup) to ask "Prettier? Lint? Snake?" (or a small set of check categories) and write run-checks.sh or config so those run/skip.                                   |
| 3   | **Wizard: auth**                    | Keep current "log in to Codex / Cursor" prompts; optionally print dashboard link at end.                                                                                           |
| 4   | **Dashboard: presets**              | Introduce presets (data model + storage). Default preset "Vibe Code" = GitHub + Supabase, all commands. UI: select preset, "Create new preset", drag & drop providers into preset. |
| 5   | **Dashboard: grouping**             | Supabase section (commands + toggles), GitHub section (commands + toggles). Each command has "run checks" on/off (and optionally "run hooks" for Supabase).                        |
| 6   | **Dashboard: check toggles**        | On/off for: Lint, Prettier, Build, Test, (Snyk?), Backend checks, AI review. Persist to config / run-checks args so run-checks.sh respects them.                                   |
| 7   | **Config ↔ presets**                | When user selects preset or toggles, write .shimwrappercheckrc (and optional presets file) so existing shim bins work without change.                                              |
| 8   | **CLI → dashboard link**            | After init/setup, print dashboard URL (local or deployed).                                                                                                                         |

---

## 5. Suggested order (when you implement)

1. **Presets data model** (file format + default "Vibe Code" preset).
2. **Dashboard: Presets UI** (select preset, show Supabase vs Git groups, command toggles) and **map to .shimwrappercheckrc**.
3. **Dashboard: Check toggles** (lint, prettier, build, test, AI review, …) and **map to SHIM_CHECKS_ARGS or run-checks config**.
4. **Dashboard: Custom presets** (create new, drag & drop providers).
5. **CLI: setup command** (install + init) and **wizard: Prettier/Lint/snake** (if you want them in the wizard).
6. **CLI: print dashboard link** at end of init/setup.

No code has been changed in this repo; the above is the plan for when you start implementing.
