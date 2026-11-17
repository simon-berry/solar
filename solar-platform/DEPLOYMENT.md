# Development preview

App: Solar Workspace · Development Alpha  
Asset ID: `6a0c15bf-81b9-44ea-845e-5803a7d8d5a0`  
Current feature level: Alpha 0.4.0, organisation accounts and recovery alongside catalogue/storage analysis

Canonical app: [Solar Workspace preview](https://www.perplexity.ai/computer/a/solar-workspace-development-al-agwVv4G5ROqEXlgDp9jVoA)

## Current binding

Source folder: `solar-platform` in this Project's Files repository. Deploy the built `solar-platform/dist/public` directory to update this same preview; do not create a separate app for routine changes.

The preview uses a running Express server on port 5000. `window.__API_BASE__` in the HTML carries a deploy-time port placeholder; the deployment proxy rewrites it to the signed backend route.

The app preview is private and has not been published to a permanent public domain. A backend restart is not a guarantee of storage durability across deployment or sandbox replacement.

## Runtime

```sh
npm ci
npm run check
npm test
npm run build
npm start
```

`npm start` defaults to account mode in production. This specific private preview must be started with `AUTH_MODE=preview npm start`, or `npm run preview`; its API then requires the authenticated hosting proxy's visitor identifier. Do not use that mode on a public server. See `SELF_HOSTING.md` for independent HTTPS account-mode hosting and durable-volume/backup configuration.

Use `npm run test:http` against a running local server for HTTP smoke coverage. Review `README.md` before any non-private deployment; real authentication and independently durable storage are not implemented.

## Update procedure

1. Synchronise the Project Files repository before editing.
2. Keep the source files and this deployment binding.
3. Make changes, run automated tests and browser regression checks.
4. Build the app and start/reuse its backend.
5. Deploy the same `dist/public` folder.
6. Verify hosted reads, writes, reloads and downloads.
7. Submit source changes through Project Files, not ordinary Git commits.

Never include database files, test exports, dependencies, signed preview URLs or secrets in the source archive.

Startup performs additive migrations 002 and 003 for nullable frozen electrical/energy reports and a defaulted proposal template version. New issues use v3; v1/v2 snapshots and rendering remain intact. Back up an existing database before changing its runtime, and retain old proposal templates when adding later document versions.

Migration 004 adds account/access/audit tables only. Private preview data and account-mode organisation data remain separate; importing a project is explicit and never overwrites an existing project or issued proposal.
