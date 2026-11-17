# Solar Workspace: Self-Hosting Guide

Account mode is now implemented separately from the private synthetic-data preview. This guide describes a single-instance installation with organisation-scoped permissions, persistent SQLite storage and explicit operator backups; it does not make the engineering software certified or eliminate the need for operational/security review.

## Self-hosted quick start

The packaged Linux helper needs Bash, OpenSSL and Docker with the `docker compose` plugin; Node.js is not required on the Docker host. Run it on your own target server after extracting the source bundle, not inside the private preview sandbox.

```sh
cd solar-platform
bash script/self-host.sh configure --domain solar.your-domain.example --proxy caddy
bash script/self-host.sh check
bash script/self-host.sh up
bash script/self-host.sh status
```

Replace the example hostname with your actual domain. The bundled Caddy option requires matching DNS, externally reachable ports 80/443, no conflicting service on those ports, and persistent certificate storage; local/private names require appropriate client trust rather than automatically becoming publicly trusted ([Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)).

For an existing Plesk/Nginx/Apache/other HTTPS reverse proxy, use `--proxy external` instead. Forward that exact HTTPS hostname to `http://127.0.0.1:5000`, preserve the browser's Origin and allow request bodies of at least 10 MiB; do not expose the Node backend directly. Use `--port 5055` at initial configuration if host port 5000 is occupied, then point your existing proxy at that chosen loopback port.

- **Private configuration**: the helper creates `.env.selfhost` with mode 0600 and a locally generated 32-byte random bootstrap token. It does not print the token, overwrite existing configuration, evaluate the file as shell code or let inherited `SOLAR_*` shell exports override the selected origin/token/port.
- **First account**: read the generated setup token privately from `.env.selfhost`, open your HTTPS application and create the initial administrator. Never paste the token into chat, an issue or a public file.
- **Finish setup**: run `bash script/self-host.sh finish-setup`. It first checks the running database has an active admin, then removes the bootstrap token from the configuration and recreates the app service without that token.
- **Stable storage identity**: the helper stores an explicit Compose project name, default `solar-workspace`, so moving/renaming the source folder does not silently select a fresh data volume. Use `--project another-name` only for a deliberate separate installation.
- **Existing installations**: do not switch an existing Compose deployment to a new project name blindly. Preserve its existing project/volume identity and take/verify a backup before upgrading; configure `--project` to match it if adopting this helper.
- **Network scope**: the bundled Caddy profile publishes ports 80/443, while Node remains loopback-bound. This is a deployment template, not a completed public-service security review; use a controlled pilot/VPN or appropriate network restrictions until the remaining release gates are resolved.

The Caddy service has persistent `/data` and `/config` volumes and reaches `solar:5000` over the Compose network, not the host's loopback address ([Caddy Docker guidance](https://caddyserver.com/docs/running)).

```sh
bash script/self-host.sh logs
bash script/self-host.sh backup
bash script/self-host.sh stop
# Resume/update from the same source/config/project identity:
bash script/self-host.sh up
```

`backup` runs the application's verified online backup inside the container, copies it to the operator's local `backups/` with restricted permissions, and leaves the original backup in the persistent volume. Encrypt/replicate it off-host and test restoration; neither copy protects against losing the entire server. `stop` retains all volumes and no helper action runs `down --volumes`.

Store `.env.selfhost` securely outside version control. `SOLAR_CONFIG_DIRECTORY` may point at a separate private configuration/backup directory; use the same value on every helper invocation. Certificate state, application data and bootstrap configuration are not part of the downloadable source archive.

The Caddy image defaults to its maintained major-2 Alpine tag; an operator may export `SOLAR_CADDY_IMAGE` in their shell to pin a reviewed image/digest. Initial setup does not configure DNS/firewalls, install Docker, obtain remote server access, create offsite backups or certify engineering output.

## Deployment modes

- **Accounts**: the default when starting the production build. Requires an HTTPS `PUBLIC_ORIGIN`, a persistent `DATABASE_PATH`, and an initial random `SETUP_TOKEN` of at least 32 characters when no accounts exist.
- **Preview**: explicitly selected with `AUTH_MODE=preview`, or the development default. Browser-visitor separation is only supported behind the authenticated private hosting proxy; this mode must never be exposed as a public customer service.
- **Development accounts**: `AUTH_MODE=accounts PUBLIC_ORIGIN=http://127.0.0.1:5002` is supported with the development server for local testing. Do not use development cookies without HTTPS outside localhost.

The hosted Perplexity preview remains preview mode because its restricted iframe cannot provide ordinary first-party account cookies. A copied visitor identifier is never accepted as a login in account mode, and old preview records are not silently transferred to a new organisation.

## Native Node deployment

Alpha 0.7 adds optional map/provider configuration and saved site/polygon geometry; the original persistence and account setup remain unchanged. See `MAPS.md` for the complete workflow, privacy disclosures, self-hosted Photon/style URLs and optional server-side MapTiler key.

Street maps and explicit address lookup work without a paid key but require external connectivity after the user's opt-in. Satellite stays disabled without your own authorised provider key; no live licensed imagery has been verified in this preview.

```sh
npm ci
npm run check
npm test
npm run build

mkdir -p /your/private/persistent/solar
export DATABASE_PATH=/your/private/persistent/solar/solar.db
export PUBLIC_ORIGIN=https://solar.your-domain.example
export AUTH_MODE=accounts
# Generate SETUP_TOKEN locally, keep it secret, and store it securely in your service configuration.
export SETUP_TOKEN="$(openssl rand -hex 32)"
npm start
```

Use a process supervisor, terminate trusted HTTPS at your existing reverse proxy, forward to the Node backend on its private interface, and expose only the HTTPS application origin. `PUBLIC_ORIGIN` must exactly identify that browser origin, with no path/query/credentials.

Open your application, create the initial administrator using the setup token, then remove `SETUP_TOKEN` from the service environment and restart. Initial setup is disabled once any user exists even if the token was accidentally retained; keep the token out of shell history, source control and application logs.

Self-hosted HTML is served with a same-origin API base rather than the private preview's port placeholder. Do not deploy the raw static `dist/public` files independently to an unrelated origin and expect account cookies or private preview routing to work.

## Container deployment

```sh
export SOLAR_PUBLIC_ORIGIN=https://solar.your-domain.example
export SOLAR_SETUP_TOKEN="$(openssl rand -hex 32)"
docker compose up -d --build
```

The supplied Compose file binds the backend to host loopback, uses a named `solar-data` volume and runs the Node process as the unprivileged image user. Put your HTTPS reverse proxy in front, complete initial setup, remove the bootstrap token from your operator environment and recreate the service.

- **Persistence**: the volume holds `/app/data/solar.db`; replacing the container does not replace this volume. Never use `docker compose down --volumes` on a live installation unless you explicitly intend to destroy that data.
- **Build verification**: run the Docker build on your target environment before relying on the image. A missing container engine in the development sandbox is not evidence that a container build was executed.
- **Configuration verification**: combined Compose configuration and the Caddyfile were parsed using real upstream CLIs. Helper tests use a mock Docker command for refusal/token-removal paths; no image build, running-container test or public certificate issuance is claimed.
- **Scaling**: this is a single-instance SQLite deployment, not clustered PostgreSQL or a high-availability system. Manage disk space, database permissions, backups and upgrades before using real operational data.

## Roles and sessions

- **Admin**: create/edit/import/restore projects, upload evidence, submit saved engineering snapshots, issue preliminary documents and manage members/invitations. May record external reviews of another user's submission.
- **Designer**: create/edit/import/restore projects, upload evidence, submit saved engineering snapshots, edit pricing and issue preliminary proposals/technical packs.
- **Estimator**: view/download, edit pricing only and issue preliminary proposals; changes to any site/design/energy fields are rejected server-side.
- **Reviewer**: view/download and record scoped assessments of another user's submitted external report evidence. Cannot edit designs, upload evidence or issue packs; this role does not confer software certification or installation approval.
- **Read-only**: view and download only.

Passwords require 14–128 characters and are stored with individual salts and scrypt hashes, not plaintext. Opaque 12-hour session proofs are stored hashed, issued in HttpOnly/Secure/SameSite=Strict production cookies, revoked by logout/password change/member changes, and limited to ten concurrent sessions per user.

Mutating requests enforce the configured Origin, rate limits cover account access attempts, and role/member changes are checked on every authenticated request. Deactivating/demoting the last active administrator is rejected; organisation access and audit events are scoped server-side.

This release does not yet supply MFA, email verification, automated password-reset emails, SSO, a full security audit or public self-service organisation signup. Do not describe those as implemented.

## Invitations and password recovery

Admins create invitations in Team & access and share the one-time token privately with the intended colleague. Tokens bind email, role and organisation, expire after 48 hours, can be revoked and cannot be replayed; no email is sent automatically.

An active signed-in user can change their password in the account page. A server operator can reset a forgotten password using an environment variable rather than a command-line password:

```sh
read -rsp "Temporary replacement password: " SOLAR_RECOVERY_PASSWORD
echo
export SOLAR_RECOVERY_PASSWORD
DATABASE_PATH=/your/private/persistent/solar/solar.db npm run account:reset -- colleague@example.com
unset SOLAR_RECOVERY_PASSWORD
```

The reset revokes all sessions for that account and records an operator recovery audit event. Deliver replacement credentials securely and require the colleague to set their own password; access to the database/host remains privileged administrative access.

## Backup and restore

```sh
DATABASE_PATH=/your/private/persistent/solar/solar.db npm run backup -- /your/private/backups/solar-backup.db
```

The backup command uses SQLite's online backup mechanism, checks integrity, writes with mode 0600 and refuses to overwrite an existing destination. Treat the database backup as sensitive: it includes all organisations' data, evidence file bytes, salted password hashes and hashed session/invitation records.

Schedule this command using your host's backup system, encrypt and replicate backups off-host, define retention and test restoration regularly. This source package does not silently create a recurring automation or an offsite backup service.

- **Restore drill**: verify integrity in a separate copy and start an isolated app against it before touching production.
- **Live restore**: stop the service, retain a verified backup of the current database, follow SQLite's WAL-safe replacement procedure for your installation, and restore the tested backup into the configured persistent path with correct owner/permissions.
- **Project-only recovery**: Import project accepts a portable project JSON as a new project. Documents → Saved revision history restores a prior design as a new revision without rewriting issued proposals.
- **Scope**: source Project Files do not back up live runtime records. Named volumes do not replace tested offsite backups.

## Release readiness

Accounts, recovery and external evidence/review records remove specific alpha blockers, not every production/MVP gap. Native electrical/structural calculation scope, independent professional validation, MCS methods, customer terms/acceptance, a broader UK equipment catalogue, monitoring and deployment-specific privacy/security controls remain separate release gates. See `ENGINEERING.md` for evidence limits and why no installation release is available.
