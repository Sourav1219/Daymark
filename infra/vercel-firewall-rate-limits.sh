#!/usr/bin/env bash
set -euo pipefail

# Run after `vercel link`. Rules are staged as a draft so the diff can be
# reviewed before `vercel firewall publish --yes` makes them live.
vercel firewall rules add "Daymark auth API rate limit" \
  --condition '{"type":"path","op":"pre","value":"/api/auth"}' \
  --action rate_limit \
  --rate-limit-window 60 \
  --rate-limit-requests 30 \
  --rate-limit-keys ip \
  --rate-limit-action rate_limit \
  --yes

vercel firewall rules add "Daymark offline mutation rate limit" \
  --condition '{"type":"path","op":"eq","value":"/api/offline/mutations"}' \
  --condition '{"type":"method","op":"eq","value":"POST"}' \
  --action rate_limit \
  --rate-limit-window 60 \
  --rate-limit-requests 60 \
  --rate-limit-keys ip \
  --rate-limit-action rate_limit \
  --yes

vercel firewall rules add "Daymark timer API rate limit" \
  --condition '{"type":"path","op":"pre","value":"/api/timer"}' \
  --action rate_limit \
  --rate-limit-window 60 \
  --rate-limit-requests 120 \
  --rate-limit-keys ip \
  --rate-limit-action rate_limit \
  --yes

vercel firewall rules add "Daymark Server Action rate limit" \
  --condition '{"type":"server_action","op":"ex"}' \
  --action rate_limit \
  --rate-limit-window 60 \
  --rate-limit-requests 120 \
  --rate-limit-keys ip \
  --rate-limit-action rate_limit \
  --yes

vercel firewall diff
