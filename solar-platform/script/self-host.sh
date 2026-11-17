#!/usr/bin/env bash
# Linux operator helper. Never sources/evaluates the secret environment file.
set -euo pipefail
umask 077
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_DIR="${SOLAR_CONFIG_DIRECTORY:-$ROOT}"
CONFIG="$CONFIG_DIR/.env.selfhost"
action="${1:-help}"
if (($#)); then shift; fi
fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
help() {
  printf '%s\n' \
    'Solar Workspace self-hosting helper (Linux + Bash + OpenSSL + Docker Compose plugin)' \
    '  bash script/self-host.sh configure --domain solar.your-domain.example --proxy external|caddy [--port 5000] [--project solar-workspace]' \
    '  bash script/self-host.sh check         # validates Compose, no deployment' \
    '  bash script/self-host.sh up            # builds/starts the configured services' \
    '  bash script/self-host.sh status' \
    '  bash script/self-host.sh logs' \
    '  bash script/self-host.sh finish-setup  # removes bootstrap token after verifying an active admin exists' \
    '  bash script/self-host.sh backup        # copies an integrity-checked DB backup to ./backups' \
    '  bash script/self-host.sh stop          # stops containers without deleting volumes' \
    'Read SELF_HOSTING.md before using real data. Never delete live named volumes.'
}
validate() {
  [[ ${#domain} -le 253 && "$domain" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]] ||
    fail 'Use a bare DNS hostname, not a URL, IP address, port, wildcard or path.'
  [[ "$proxy" == external || "$proxy" == caddy ]] || fail 'Proxy must be external or caddy.'
  [[ "$port" =~ ^[0-9]{4,5}$ ]] || fail 'Host port must be an integer from 1024 to 65535.'
  ((10#$port >= 1024 && 10#$port <= 65535)) || fail 'Host port must be from 1024 to 65535.'
  [[ "$project" =~ ^[a-z0-9][a-z0-9_-]{0,62}$ ]] || fail 'Invalid Compose project name.'
}
if [[ "$action" == help || "$action" == --help ]]; then help; exit 0; fi
if [[ "$action" == configure ]]; then
  domain=""; proxy=external; port=5000; project=solar-workspace
  while (($#)); do
    (($# >= 2)) || fail "Missing value for $1."
    case "$1" in
      --domain) domain="$2";;
      --proxy) proxy="$2";;
      --port) port="$2";;
      --project) project="$2";;
      *) fail "Unknown option $1.";;
    esac
    shift 2
  done
  if [[ -z "$domain" ]]; then
    [[ -t 0 ]] || fail 'Pass --domain, or run configure interactively.'
    read -r -p 'Hostname only (for example solar.your-domain.example): ' domain
    read -r -p 'Proxy mode [external/caddy; default external]: ' proxy
    proxy="${proxy:-external}"
  fi
  domain="${domain,,}"
  validate
  [[ ! -e "$CONFIG" && ! -L "$CONFIG" ]] || fail 'Configuration already exists; it has not been overwritten.'
  command -v openssl >/dev/null || fail 'OpenSSL is required to generate the bootstrap token.'
  token="$(openssl rand -hex 32)"
  [[ "$token" =~ ^[a-f0-9]{64}$ ]] || fail 'Could not generate the bootstrap token.'
  mkdir -p -- "$CONFIG_DIR"
  (
    set -o noclobber
    printf '%s\n' '# Private operator configuration. Do not share or commit this file.' \
      "SOLAR_DOMAIN=$domain" "SOLAR_PUBLIC_ORIGIN=https://$domain" \
      "SOLAR_SETUP_TOKEN=$token" "SOLAR_PROXY=$proxy" \
      "SOLAR_HOST_PORT=$port" "SOLAR_COMPOSE_PROJECT=$project" > "$CONFIG"
  ) || fail 'Configuration could not be created safely.'
  printf 'Created private configuration for https://%s (proxy: %s).\n' "$domain" "$proxy"
  printf 'The setup token is only in %s; read it privately on this server.\n' "$CONFIG"
  printf '%s\n' 'Run check, then up. After creating the first administrator, run finish-setup.'
  exit 0
fi
case "$action" in check|up|status|logs|finish-setup|backup|stop) ;; *) help; fail "Unknown action $action.";; esac
(($# == 0)) || fail 'Unexpected command arguments.'
[[ -f "$CONFIG" && ! -L "$CONFIG" ]] || fail 'Run configure first; symlinked secret configuration is not accepted.'
[[ "$(stat -c '%a' "$CONFIG")" == 600 ]] || fail 'Secret configuration must have mode 0600. Run chmod 600 on it.'
domain=""; origin=""; token=""; proxy=""; port=""; project=""
declare -A seen=()
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  [[ "$line" == *=* ]] || fail 'Invalid configuration line.'
  key="${line%%=*}"; value="${line#*=}"
  [[ "$key" =~ ^SOLAR_[A-Z_]+$ ]] || fail 'Invalid configuration key; no shell content is evaluated.'
  [[ -z "${seen[$key]:-}" ]] || fail 'Repeated configuration key.'
  seen["$key"]=1
  case "$key" in
    SOLAR_DOMAIN) domain="$value";;
    SOLAR_PUBLIC_ORIGIN) origin="$value";;
    SOLAR_SETUP_TOKEN) token="$value";;
    SOLAR_PROXY) proxy="$value";;
    SOLAR_HOST_PORT) port="$value";;
    SOLAR_COMPOSE_PROJECT) project="$value";;
    SOLAR_MAPS_ENABLED|SOLAR_ADDRESS_SEARCH_ENABLED)
      [[ "$value" == true || "$value" == false ]] || fail 'Map/search flags must be true or false.';;
    SOLAR_MAP_STYLE_URL|SOLAR_PHOTON_URL)
      [[ -z "$value" || "$value" =~ ^https://[a-zA-Z0-9./:_?=%+-]+$ ]] || fail 'Map provider URLs must be HTTPS without shell syntax, credentials or fragments.';;
    SOLAR_MAPTILER_API_KEY)
      [[ "$value" =~ ^[a-zA-Z0-9_-]{0,200}$ ]] || fail 'Unexpected satellite-key format; keep secrets private.';;
    *) fail 'Unrecognised configuration key; no shell content is evaluated.';;
  esac
done < "$CONFIG"
validate
[[ "$origin" == "https://$domain" ]] || fail 'Configured origin must exactly match the HTTPS hostname.'
[[ -z "$token" || "$token" =~ ^[a-f0-9]{64}$ ]] || fail 'Unexpected bootstrap-token format.'
for key in SOLAR_DOMAIN SOLAR_PUBLIC_ORIGIN SOLAR_SETUP_TOKEN SOLAR_PROXY SOLAR_HOST_PORT SOLAR_COMPOSE_PROJECT; do
  [[ -n "${seen[$key]:-}" ]] || fail "Missing configuration key $key."
done
command -v docker >/dev/null || fail 'Docker with the docker compose plugin is required. Install it on the target server first.'
# Shell exports otherwise outrank --env-file, including an old bootstrap token.
compose=(env -u SOLAR_DOMAIN -u SOLAR_PUBLIC_ORIGIN -u SOLAR_SETUP_TOKEN -u SOLAR_PROXY -u SOLAR_HOST_PORT -u SOLAR_COMPOSE_PROJECT
  -u SOLAR_MAPS_ENABLED -u SOLAR_ADDRESS_SEARCH_ENABLED -u SOLAR_MAP_STYLE_URL -u SOLAR_PHOTON_URL -u SOLAR_MAPTILER_API_KEY
  docker compose --project-directory "$ROOT" --project-name "$project" --env-file "$CONFIG" -f "$ROOT/compose.yaml")
if [[ "$proxy" == caddy ]]; then compose+=(-f "$ROOT/compose.https.yaml"); fi
case "$action" in
  check) "${compose[@]}" config --quiet; printf '%s\n' 'Compose configuration is valid. Image build, DNS, TLS and backups still require target-host verification.';;
  up) "${compose[@]}" up -d --build;;
  status) "${compose[@]}" ps;;
  logs) "${compose[@]}" logs --tail=100;;
  stop) "${compose[@]}" stop;;
  finish-setup)
    "${compose[@]}" exec -T solar node -e \
      "const db=require('better-sqlite3')(process.env.DATABASE_PATH,{readonly:true,fileMustExist:true});const n=db.prepare(\"SELECT count(*) n FROM solar_users WHERE active=1 AND role='admin'\").get().n;db.close();process.exit(n>0?0:2)" ||
      fail 'An active administrator could not be verified. Bootstrap token has not been changed.'
    temporary="$(mktemp "$CONFIG_DIR/.solar-config.XXXXXXXX")"
    trap 'rm -f -- "$temporary"' EXIT
    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ "$line" == SOLAR_SETUP_TOKEN=* ]]; then printf '%s\n' 'SOLAR_SETUP_TOKEN='; else printf '%s\n' "$line"; fi
    done < "$CONFIG" > "$temporary"
    chmod 600 "$temporary"
    mv -- "$temporary" "$CONFIG"
    trap - EXIT
    "${compose[@]}" up -d --no-build solar
    printf '%s\n' 'Bootstrap token removed from operator configuration and the application environment.'
    ;;
  backup)
    name="solar-$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 4).db"
    "${compose[@]}" exec -T solar node script/backup.mjs "/app/data/backups/$name"
    mkdir -p -- "$CONFIG_DIR/backups"
    chmod 700 "$CONFIG_DIR/backups"
    "${compose[@]}" cp "solar:/app/data/backups/$name" "$CONFIG_DIR/backups/$name"
    chmod 600 "$CONFIG_DIR/backups/$name"
    printf 'Backup copied to %s/backups/%s. Encrypt/replicate it off this host and test restoration.\n' "$CONFIG_DIR" "$name"
    ;;
esac
