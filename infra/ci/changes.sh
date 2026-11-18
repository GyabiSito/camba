#!/usr/bin/env bash
set -euo pipefail

base=${1:?base commit required}
head=${2:?head commit required}

git rev-parse --verify --end-of-options "${head}^{commit}" >/dev/null
if ! git rev-parse --verify --end-of-options "${base}^{commit}" >/dev/null 2>&1; then
  printf 'api=true\nweb=true\ninfra=true\n'
  exit 0
fi

changed() {
  local key=$1 code=0
  shift
  git diff --quiet --no-renames "$base" "$head" -- "$@" || code=$?
  case $code in
    0) printf '%s=false\n' "$key" ;;
    1) printf '%s=true\n' "$key" ;;
    *) return "$code" ;;
  esac
}

changed api api infra .github/workflows
changed web web infra .github/workflows
changed infra infra .github/workflows
