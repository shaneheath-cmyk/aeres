# Aeres PAX Agent — PAX-NODE-01 Setup

Push agent that ships real CrowdSec decisions and nginx log anomalies to Aeres every 5 minutes.

## Requirements

- `bash`, `curl`, `jq` (install: `apt install curl jq`)
- `cscli` — CrowdSec CLI (already present if CrowdSec is running)
- nginx access/error logs at `/var/log/nginx/` (default)

## Install

```bash
# 1. Copy files
sudo mkdir -p /opt/aeres /etc/aeres
sudo cp pax-agent.sh /opt/aeres/pax-agent.sh
sudo chmod +x /opt/aeres/pax-agent.sh

# 2. Create env file with your secrets (never commit this)
sudo tee /etc/aeres/pax-agent.env > /dev/null <<EOF
AERES_INGEST_URL=https://YOUR_REPLIT_DOMAIN/api/aeres/ingest
AERES_INGEST_SECRET=YOUR_SECRET_HERE
SOURCE_NAME=PAX-NODE-01
EOF
sudo chmod 600 /etc/aeres/pax-agent.env

# 3. Test manually
sudo /opt/aeres/pax-agent.sh

# 4. Install systemd timer
sudo cp pax-agent.service pax-agent.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pax-agent.timer

# 5. Verify timer is running
systemctl status pax-agent.timer
journalctl -u pax-agent.service -f
```

## What it ships

| Source | What | Endpoint |
|--------|------|----------|
| CrowdSec | Active ban/captcha decisions (`cscli decisions list`) | `POST /api/aeres/ingest/crowdsec` |
| nginx access.log | Rapid 4xx floods (≥20 hits/interval per IP), brute-force (≥10 auth failures per path) | `POST /api/aeres/ingest/nginx` |
| nginx error.log | `crit`/`emerg`/`alert` level errors | `POST /api/aeres/ingest/nginx` |

## Severity mapping

**CrowdSec**
- `critical` — ≥100 attacks OR bruteforce/credential/backdoor scenario
- `high` — ≥30 attacks OR scan/probing/exploit scenario → queued for approval
- `medium` — ≥10 attacks
- `low` — everything else

**nginx**
- `critical` — brute_force, slow_loris → auto-mitigated
- `high` — scanner, rapid_4xx flood ≥50 → queued for approval
- `medium` — error_spike, unusual_ua

## Tuning

Edit `/etc/aeres/pax-agent.env` to override defaults:

```bash
NGINX_LOOKBACK_MINUTES=6       # should match cron/timer interval
RAPID_4XX_THRESHOLD=20         # min hits to report a rapid-4xx event
CROWDSEC_MAX_DECISIONS=50      # max CrowdSec decisions per run
```

## Cron alternative (if you prefer over systemd)

```
*/5 * * * * root AERES_INGEST_URL=https://YOUR_DOMAIN/api/aeres/ingest AERES_INGEST_SECRET=YOUR_SECRET /opt/aeres/pax-agent.sh >> /var/log/pax-agent.log 2>&1
```
