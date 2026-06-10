#!/usr/bin/env bash
# =============================================================================
# pax-agent.sh — Aeres push agent for PAX-NODE-01
# Reads CrowdSec decisions + nginx log anomalies, ships them to Aeres ingest.
#
# INSTALL:
#   1. Copy this file to PAX-NODE-01, e.g. /opt/aeres/pax-agent.sh
#   2. chmod +x /opt/aeres/pax-agent.sh
#   3. Set AERES_INGEST_URL and AERES_INGEST_SECRET (see config below)
#   4. Run once manually to test: /opt/aeres/pax-agent.sh
#   5. Add to cron for periodic push:
#        */5 * * * * /opt/aeres/pax-agent.sh >> /var/log/pax-agent.log 2>&1
#      Or as a systemd timer — see pax-agent.service / pax-agent.timer below.
#
# REQUIREMENTS: bash, curl, jq, cscli (CrowdSec CLI)
# =============================================================================

set -euo pipefail

# --- Configuration -----------------------------------------------------------
# Override via environment or edit directly here.
AERES_INGEST_URL="${AERES_INGEST_URL:-https://YOUR_REPLIT_DOMAIN/api/aeres/ingest}"
AERES_INGEST_SECRET="${AERES_INGEST_SECRET:-REPLACE_WITH_YOUR_SECRET}"
SOURCE_NAME="${SOURCE_NAME:-PAX-NODE-01}"

NGINX_ACCESS_LOG="${NGINX_ACCESS_LOG:-/var/log/nginx/access.log}"
NGINX_ERROR_LOG="${NGINX_ERROR_LOG:-/var/log/nginx/error.log}"

# How many minutes back to look in nginx logs (should match cron interval)
NGINX_LOOKBACK_MINUTES="${NGINX_LOOKBACK_MINUTES:-6}"

# Minimum hit count before reporting a rapid-4xx event
RAPID_4XX_THRESHOLD="${RAPID_4XX_THRESHOLD:-20}"

# CrowdSec: max decisions to ship per run
CROWDSEC_MAX_DECISIONS="${CROWDSEC_MAX_DECISIONS:-50}"

# State dir for deduplication
STATE_DIR="${STATE_DIR:-/var/lib/pax-agent}"
mkdir -p "$STATE_DIR"

CROWDSEC_SEEN_FILE="$STATE_DIR/crowdsec_seen.txt"
touch "$CROWDSEC_SEEN_FILE"

# --- Helpers -----------------------------------------------------------------
log() { echo "[$(date -Iseconds)] $*"; }

post_json() {
  local endpoint="$1"
  local payload="$2"
  local response
  response=$(curl -sf -X POST \
    -H "Authorization: Bearer ${AERES_INGEST_SECRET}" \
    -H "Content-Type: application/json" \
    --data "$payload" \
    "${AERES_INGEST_URL}/${endpoint}" 2>&1) || {
    log "ERROR: POST to ${endpoint} failed: $response"
    return 1
  }
  log "OK ${endpoint}: $response"
}

# --- CrowdSec ----------------------------------------------------------------
ingest_crowdsec() {
  if ! command -v cscli &>/dev/null; then
    log "SKIP crowdsec: cscli not found"
    return
  fi

  log "Fetching CrowdSec decisions..."

  # Get active decisions as JSON
  local raw
  raw=$(cscli decisions list -o json 2>/dev/null) || {
    log "WARN: cscli decisions list failed (check permissions)"
    return
  }

  if [ -z "$raw" ] || [ "$raw" = "null" ] || [ "$raw" = "[]" ]; then
    log "CrowdSec: no active decisions"
    return
  fi

  # Build payload — deduplicate by "id" field, limit to N
  local payload
  payload=$(echo "$raw" | jq --argjson max "$CROWDSEC_MAX_DECISIONS" --slurpfile seen "$CROWDSEC_SEEN_FILE" '
    . as $all |
    ($seen[0] // []) as $seen_ids |
    [ $all[] |
      select(.id | tostring | IN($seen_ids[]?) | not) |
      {
        ip:          (.value // .source.ip // "unknown"),
        type:        (.type // "ban"),
        scope:       (.scope // "Ip"),
        duration:    (.duration // "unknown"),
        scenario:    (.reason // "unknown"),
        origin:      (.origin // "crowdsec"),
        country:     (.source.cn // null),
        asName:      (.source.as_name // null),
        attacksCount: ((.decisions[0].count // 1) | tonumber? // 1)
      }
    ] | .[0:$max]
  ')

  local count
  count=$(echo "$payload" | jq 'length')
  if [ "$count" -eq 0 ]; then
    log "CrowdSec: all decisions already seen"
    return
  fi

  log "CrowdSec: shipping $count new decision(s)"
  local full_payload
  full_payload=$(jq -n --argjson d "$payload" --arg src "$SOURCE_NAME" \
    '{ decisions: $d, source: $src }')

  post_json "crowdsec" "$full_payload"

  # Update seen IDs
  echo "$raw" | jq -r '[.[].id | tostring]' > "$CROWDSEC_SEEN_FILE"
}

# --- nginx -------------------------------------------------------------------
ingest_nginx() {
  if [ ! -f "$NGINX_ACCESS_LOG" ]; then
    log "SKIP nginx: $NGINX_ACCESS_LOG not found"
    return
  fi

  log "Analysing nginx access log (last ${NGINX_LOOKBACK_MINUTES}m)..."

  # Build a cutoff timestamp string in nginx log format: DD/Mon/YYYY:HH:MM
  local cutoff_epoch
  cutoff_epoch=$(date -d "${NGINX_LOOKBACK_MINUTES} minutes ago" +%s 2>/dev/null || \
                 date -v "-${NGINX_LOOKBACK_MINUTES}M" +%s 2>/dev/null) # macOS fallback

  # Extract recent lines (approximation: take last 50k lines, then filter by time)
  local recent_lines
  recent_lines=$(tail -n 50000 "$NGINX_ACCESS_LOG" | awk -v cutoff="$cutoff_epoch" '
    {
      # Parse nginx combined log: 1.2.3.4 - - [01/Jan/2024:12:00:00 +0000] "GET / HTTP/1.1" 200 ...
      match($0, /\[([0-9]{2})\/([A-Za-z]{3})\/([0-9]{4}):([0-9]{2}):([0-9]{2}):([0-9]{2})/, m)
      if (RSTART > 0) {
        months = "Jan:1 Feb:2 Mar:3 Apr:4 May:5 Jun:6 Jul:7 Aug:8 Sep:9 Oct:10 Nov:11 Dec:12"
        n = split(months, ma, " ")
        mon = 1
        for (i=1;i<=n;i++) { split(ma[i],p,":"); if(p[1]==m[2]) mon=p[2] }
        ts = mktime(m[3] " " mon " " m[1] " " m[4] " " m[5] " " m[6])
        if (ts >= cutoff) print $0
      }
    }
  ')

  if [ -z "$recent_lines" ]; then
    log "nginx: no recent access log lines"
  else
    # Detect rapid 4xx per IP
    local rapid4xx_events
    rapid4xx_events=$(echo "$recent_lines" | awk -v threshold="$RAPID_4XX_THRESHOLD" '
      {
        ip = $1
        match($0, /" ([0-9]{3}) /, m)
        status = m[1]+0
        match($0, /"[A-Z]+ ([^ ]+)/, p)
        path = p[1]
        ua = ""
        match($0, /"([^"]+)"$/, u)
        ua = u[1]
        if (status >= 400 && status < 500) {
          count[ip]++
          paths[ip] = path
          uas[ip] = ua
          statuses[ip] = status
        }
      }
      END {
        for (ip in count) {
          if (count[ip] >= threshold) {
            printf "%s\t%s\t%s\t%s\t%d\n", ip, paths[ip], uas[ip], statuses[ip], count[ip]
          }
        }
      }
    ')

    # Detect brute force (many 401/403 to same path)
    local brute_events
    brute_events=$(echo "$recent_lines" | awk '
      {
        ip = $1
        match($0, /" ([0-9]{3}) /, m)
        status = m[1]+0
        match($0, /"[A-Z]+ ([^ ]+)/, p)
        path = p[1]
        if (status == 401 || status == 403) {
          key = ip SUBSEP path
          count[key]++
          ips[key] = ip
          paths[key] = path
        }
      }
      END {
        for (k in count) {
          if (count[k] >= 10) {
            printf "%s\t%s\t%d\n", ips[k], paths[k], count[k]
          }
        }
      }
    ')

    local events_json="[]"
    local now_ts
    now_ts=$(date -Iseconds)

    # Append rapid_4xx events
    while IFS=$'\t' read -r ip path ua status count; do
      [ -z "$ip" ] && continue
      local event
      event=$(jq -n \
        --arg type "rapid_4xx" \
        --arg ip "$ip" \
        --arg path "$path" \
        --arg ua "$ua" \
        --argjson status "$status" \
        --argjson count "$count" \
        --arg ts "$now_ts" \
        '{ type: $type, ip: $ip, path: $path, statusCode: $status, timestamp: $ts, count: $count, userAgent: $ua }')
      events_json=$(echo "$events_json" | jq --argjson e "$event" '. + [$e]')
    done <<< "$rapid4xx_events"

    # Append brute_force events
    while IFS=$'\t' read -r ip path count; do
      [ -z "$ip" ] && continue
      local event
      event=$(jq -n \
        --arg type "brute_force" \
        --arg ip "$ip" \
        --arg path "$path" \
        --argjson count "$count" \
        --arg ts "$now_ts" \
        '{ type: $type, ip: $ip, path: $path, statusCode: 401, timestamp: $ts, count: $count }')
      events_json=$(echo "$events_json" | jq --argjson e "$event" '. + [$e]')
    done <<< "$brute_events"

    local event_count
    event_count=$(echo "$events_json" | jq 'length')
    if [ "$event_count" -gt 0 ]; then
      log "nginx: shipping $event_count anomaly event(s)"
      local payload
      payload=$(jq -n --argjson e "$events_json" --arg src "$SOURCE_NAME" \
        '{ events: $e, source: $src }')
      post_json "nginx" "$payload"
    else
      log "nginx: no anomalies detected"
    fi
  fi

  # Also tail error.log for critical errors
  if [ -f "$NGINX_ERROR_LOG" ]; then
    local error_lines
    error_lines=$(tail -n 1000 "$NGINX_ERROR_LOG" | grep -i "crit\|emerg\|alert" | tail -n 10 || true)
    if [ -n "$error_lines" ]; then
      local err_count
      err_count=$(echo "$error_lines" | wc -l | tr -d ' ')
      log "nginx: found $err_count critical error log line(s)"
      local payload
      payload=$(jq -n \
        --arg src "$SOURCE_NAME" \
        --arg detail "$error_lines" \
        --argjson count "$err_count" \
        '{
          events: [{
            type: "error_spike",
            ip: "unknown",
            path: "/",
            statusCode: 500,
            timestamp: (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
            count: $count,
            detail: $detail
          }],
          source: $src
        }')
      post_json "nginx" "$payload"
    fi
  fi
}

# --- Main --------------------------------------------------------------------
log "=== pax-agent starting (source: $SOURCE_NAME) ==="
ingest_crowdsec
ingest_nginx
log "=== pax-agent done ==="
