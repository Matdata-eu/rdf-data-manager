#!/bin/sh
# Writes config.json from RDM_* variables. Unset variables are left out, so the app's own
# defaults and the user's settings apply. See docs/CONFIG.md for the keys.
set -e
out=/usr/share/nginx/html/config.json
if [ -n "$RDM_DATASET" ] && [ -z "$RDM_QUERY_URL" ]; then
  base=$(printf '%s' "$RDM_DATASET" | sed 's#/*$##')
  RDM_QUERY_URL="$base/query"
  RDM_UPDATE_URL="${RDM_UPDATE_URL:-$base/update}"
fi
json="{"
add() { # key value
  [ -z "$2" ] && return 0
  [ "$json" != "{" ] && json="$json,"
  json="$json\"$1\":$2"
}
str() { printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"; }
add queryUrl "$([ -n "$RDM_QUERY_URL" ] && str "$RDM_QUERY_URL")"
add updateUrl "$([ -n "$RDM_UPDATE_URL" ] && str "$RDM_UPDATE_URL")"
add dataGraph "$([ -n "$RDM_DATA_GRAPH" ] && str "$RDM_DATA_GRAPH")"
if [ -n "$RDM_SHAPES_URL" ]; then
  add shapes "{\"source\":\"url\",\"url\":$(str "$RDM_SHAPES_URL")}"
elif [ -n "$RDM_SHAPES_GRAPH" ]; then
  add shapes "{\"source\":\"endpoint\",\"graph\":$(str "$RDM_SHAPES_GRAPH")}"
fi
add language "$([ -n "$RDM_LANGUAGE" ] && str "$RDM_LANGUAGE")"
add timeoutMs "$RDM_TIMEOUT_MS"
add locked "$RDM_LOCKED"
json="$json}"
if [ "$json" != "{}" ]; then
  printf '%s\n' "$json" > "$out"
  echo "config.json: $json"
fi
