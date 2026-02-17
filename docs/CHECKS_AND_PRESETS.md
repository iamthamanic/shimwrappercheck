# Checks and Presets

## Adding new check types

New checks appear in the **Check Library** and can be added to **My Checks** once they are defined.

1. **Define the check** in `dashboard/lib/checks.ts`:
   - Add an entry to `CHECK_DEFINITIONS` with `id`, `label`, `summary`, `info`, `settings`, `tags` (frontend/backend), and `role` (`"enforce"` = before command, or `"hook"` = after deploy).
   - Add the same `id` to the `CheckId` type and, if the backend uses it, to `CheckToggles` and `DEFAULT_CHECK_TOGGLES` in `dashboard/lib/presets.ts`.
2. **Backend (optional):** If the check is run by `scripts/run-checks.sh`, add the corresponding env/flag handling in the dashboard API (e.g. `app/api/settings/route.ts` and `buildRcContent` in `lib/presets.ts`) so the generated `.shimwrappercheckrc` includes it.
3. **i18n:** Add label/summary/info in `dashboard/messages/de.json` and `en.json` under `checks.<id>.label`, etc., if you use translation keys.

After that, the new check shows up in the Check Library and can be dragged into My Checks. **Enforce** vs **Hooks** in the UI is determined by each check’s `role`: enforce checks run before the command, hook checks run after deploy.

## Check descriptions

Check texts must be understandable for non-experts and still precise for experts. Use the fixed structure and wording rules described in `docs/CHECK_DESCRIPTION_STYLE.md`.

## Presets: per project, no accounts

- **Presets are stored in the project** (in the config that backs the dashboard, e.g. `.shimwrappercheckrc` or the same JSON the API uses). There are no user accounts; nothing is stored “globally” on a server.
- **Built-in presets** (e.g. “Vibe Code”) are default templates. Choosing one sets up the project’s config; saving then stores that config in the project.
- **Reusing a preset in another project:** Use **Export** in the dashboard to download a preset/check configuration as JSON. In another project, you can use that file (or re-create the same preset and check list manually). So “global” reuse is by sharing the exported file, not by a shared account.

## Enforce vs Hook

- **Enforce:** Checks that run **before** the real command (e.g. before `supabase functions deploy`). Example: Lint, Tests.
- **Hook:** Checks that run **after** deploy (post-deploy). Example: Post-Deploy Health Ping, Edge Logs.

In the dashboard, **My Checks** is grouped by role (Enforce section / Hooks section). In the **Check Library**, the “Enforce” and “Hooks” filters show only checks with that role.

## Suggest Checks categories

The **Suggest Checks** scan in the dashboard returns recommendation reasons with two categories:

- **Best Practice:** General recommendations that improve maintainability/security, even if tooling is not yet wired in the current project.
- **Ready to run:** Recommendations detected from project signals (e.g. scripts/config/dependencies) and likely runnable immediately.

For a check that matches both, the UI shows the **Ready to run** reason so users can see why it is currently executable.
