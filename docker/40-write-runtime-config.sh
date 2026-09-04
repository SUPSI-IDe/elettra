#!/bin/sh
set -eu

runtime_config_path="/usr/share/nginx/html/elettra/runtime-config.json"
carto_api_key="${CARTO_API_KEY:-}"

if [ -z "$carto_api_key" ]; then
  echo "CARTO_API_KEY is required." >&2
  exit 1
fi

case "$carto_api_key" in
  *[!A-Za-z0-9._~-]*)
    echo "CARTO_API_KEY contains unsupported characters." >&2
    exit 1
    ;;
esac

umask 022
printf '{"CARTO_API_KEY":"%s"}\n' \
  "$carto_api_key" > "$runtime_config_path"
