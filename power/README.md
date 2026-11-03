# Osud: isolated authenticated sleep/wake

Prepared implementation; not deployed or verified on the CasaOS host yet.
No file or service belonging to Folio, Gym80, Prizma or other applications is modified.

## Architecture and security boundary

Private Tailscale HTTPS :8459 → host gateway 127.0.0.1:4199 → Nginx
127.0.0.1:8099 → photo API (Docker internal only). A separate Google oauth2-proxy
listens on 127.0.0.1:4198 and serves only authentication, never application upstreams.
The gateway checks its session for every forwarded request. Only an exact Google
email allowlist is allowed. Private DNS is validated and the gateway accepts only
loopback connections with the configured Host. Tailscale Serve must remain private;
never enable Funnel. Tailnet ACLs should limit access to the intended users.

The host gateway alone runs Docker CLI. It has the host privileges required to
use Docker; the app and OAuth container get no Docker socket. Its action and container
allowlists are literal constants: only `osud-photos-1` and `osud-osud-1`, start/stop.
There is no HTTP endpoint accepting a container name or arbitrary Docker command.
The fixed container names assume the existing `osud` Compose project.
No shared database is stopped; Osud has its own atomic JSON/photo files.

Idle is 900 seconds since the most recent authenticated user interaction in any
browser. The client sends trusted pointer/key/wheel/touch events at most once per
5 seconds, not a timer heartbeat. Returning to a visible tab counts as a new visit,
not periodic activity. Status requests, API polling, Docker health checks, assets and
background PWA requests never refresh the idle clock or wake sleeping containers.
Authenticated document navigation and explicit same-origin POST wake can wake them.
Activity POST requires auth, exact Origin and custom header. There is no manual sleep
endpoint that could interrupt another user. All users share a lock and activity clock.
Concurrent wakes are serialized. Every wake starts a new 15 minute grace period.

Sleep waits until all proxied operations have finished, then holds a barrier against
new requests while stopping Nginx first and photos second (60 second graceful stop).
The API responds only after its write queue and atomic renames complete; SIGTERM
closes admission and allows accepted requests and filesystem work to finish.
A broken/missing Docker status fails closed instead of guessing other containers.
An interrupted upload is not automatically replayed. Container start is photos first,
then Nginx, and waits for both Docker health checks. If it fails, requests receive 503;
there is no destructive cleanup or volume removal. A stopped service still occupies
disk space; it releases its process RAM/CPU. Measure actual savings on the host;
this small app may save less than large backend applications.

The gateway remains running under systemd with restart-on-failure. OAuth and application
containers retain restart-unless-stopped. After a host reboot the gateway starts a new
15 minute grace period; an intentionally stopped app wakes on the next authenticated
visit. The private Tailscale Serve route must be persisted with `--bg`.

## Prerequisites to confirm on CasaOS (read only)

- Check `sudo ss -ltnp` for unused ports 4198, 4199 and 8459.
- Read `sudo docker exec tailscale tailscale status --json` locally for this host's
  DNSName; do not post the entire tailnet inventory. Confirm the Tailscale daemon
  with the chosen hostname can reach host loopback (host networking in this setup).
- Inspect `sudo docker exec tailscale tailscale serve status` for existing routes.
  Do not reset it or replace routes for other applications. If 8459 is occupied,
  stop deployment and choose a reviewed alternative consistently in gateway,
  Google redirect URI and Serve config; the code currently requires 8459.
- Ensure Google OAuth APIs and account access are available to the new proxy.
  Nothing here reuses Folio client secrets, cookies or keys.

## Installation stages — do not skip browser data migration

1. Update and build the app normally first, with the old LAN binding still active.
   On every browser/origin whose dilemmas/history you want to keep, use menu
   **Export dilem a histórie**. LAN and Tailscale IP origins have independent data.
   Keep exports private. Server photos remain in `/DATA/AppData/osud-photos`;
   do not move, recreate, chown or delete that directory. Back it up separately.

2. Create a **dedicated Google OAuth web client for Osud**. Register the exact redirect
   `https://<this-host>.ts.net:8459/oauth2/callback`. Configure the Google consent
   audience/test users as necessary. Enter its ID/secret only on CasaOS.

3. Prepare independent root-owned config. If `/etc/osud-power` already exists,
   stop and inspect its purpose before copying examples over existing settings:
   ```sh
   sudo install -d -m 700 /etc/osud-power
   sudo install -m 600 power/settings.env.example /etc/osud-power/settings.env
   sudo install -m 600 power/oauth.env.example /etc/osud-power/oauth.env
   sudo touch /etc/osud-power/allowed-emails.txt
   sudo chmod 600 /etc/osud-power/allowed-emails.txt
   ```
   Edit the files locally with `sudo nano`. Replace all placeholders in settings and
   OAuth config. Generate the cookie secret locally using
   `python3 -c 'import secrets; print(secrets.token_urlsafe(32))'` and put it in the
   OAuth config without sharing it. Put one explicitly allowed Google email per line
   in allowed-emails.txt; do not allow all email domains. The proxy's non-root user
   needs to read this file: set its mode to 644 (it contains email addresses, no
   credentials), keeping the parent directory 700 on the host.

4. Start only the dedicated auth project (no Folio compose changes):
   ```sh
   sudo docker compose --env-file /etc/osud-power/settings.env -f power/compose.auth.yml up -d
   ```
   Install the dedicated gateway:
   ```sh
   sudo install -m 644 power/osud-power.service /etc/systemd/system/osud-power.service
   sudo systemctl daemon-reload
   sudo systemctl enable --now osud-power.service
   ```
   This service assumes checkout `/DATA/AppData/osud`. Do not start it from a temporary
   ZIP directory or change the existing Folio unit. Root can read settings under /etc.

5. Add **only the unused 8459 route** after the read-only checks above:
   ```sh
   sudo docker exec tailscale tailscale serve --bg --https=8459 http://127.0.0.1:4199
   ```
   Confirm `tailscale serve status` still contains all original routes.
   Before closing LAN access, confirm Google denies an unlisted account, then
   sign in with your allowed account and check the app through the private URL.

6. Close the bypass by adding `OSUD_BIND_IP=127.0.0.1` to the application's existing
   `.env` (preserve all existing values, especially OSUD_PHOTO_DIR/OSUD_PORT).
   Keep port 8099; it is the fixed gateway upstream. Rebuild this project only:
   ```sh
   sudo docker compose up -d --build
   ```
   Verify `docker port osud-osud-1` shows `127.0.0.1:8099`, no public IPv4 or IPv6
   binding. The old IP:8099 URL must now be inaccessible from another device.
   On the HTTPS URL use **Import dilem a histórie** to restore your browser export.
   The import explicitly asks before replacing that browser's data. The old origin's
   local data is not erased; automatic cross-origin access is impossible.

## Acceptance on the real server (still required)

- Work in the app beyond 15 minutes; legitimate events keep it awake. Repeat with two
  browsers; one idle and one active must remain awake. A visible tab without interaction
  eventually sleeps. Test normal and PWA navigation/resumption.
- Leave only background status/API polls and health probes: after 900 seconds plus
  monitor resolution (5s) both app containers stop. Gateway and OAuth stay up.
- Open the private URL: authenticate, wake, wait for healthy, spin and load photos.
- Start a large upload around the idle boundary; it must finish and be retrievable
  after sleep/wake. Verify files/JSON and client dilemmas/history are unchanged.
- Check unauthorized wake and foreign-Origin POSTs are rejected; old port is closed.
- Compare other container states and existing Serve routes before/after deployment.
- Reboot CasaOS at an agreed time (affects other apps; requires separate approval),
  then verify gateway/OAuth, private HTTPS, wake and data. A local unit test is not
  proof of host reboot or Google/Tailscale integration.

Normal app updates after installation: pull GitHub, build app compose, restart only
`osud-power.service` if its code changed. Preserve /etc/osud-power and photo data.
No Google Drive backup or network access is part of this mechanism.

Rollback: stop/disable only osud-power.service and bring down only the dedicated
`power/compose.auth.yml` project. Disable only the 8459 Serve listener with Tailscale's
per-port command; never use `serve reset`. Restore the original OSUD_BIND_IP value
and rebuild the Osud app if LAN-only rollback is intended. This restores the old
unauthenticated LAN access, so make that change deliberately. Do not delete volumes.

Local Docker integration can be reproduced in an isolated project, **not the production
`osud` project**. From repository root build with
`OSUD_PORT=18099 OSUD_BIND_IP=127.0.0.1 OSUD_PHOTO_DIR=/tmp/osud-power-integration docker compose -p osud-power-check up -d --build`,
then run `OSUD_DOCKER_POWER_TEST=1 python3 tests/docker_power_check.py`.
It writes only its test photo and starts/stops only the two fixed
`osud-power-check-*` containers. Remove the disposable project afterward using
`docker compose -p osud-power-check down` with the same Compose variables; never use
`down -v` against production. Gateway production container allowlists remain unchanged.
