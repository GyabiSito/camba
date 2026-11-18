#!/usr/bin/env bash
set -euo pipefail

base=${1:?base commit required}
head=${2:?head commit required}

git rev-parse --verify --end-of-options "${head}^{commit}" >/dev/null
if ! git rev-parse --verify --end-of-options "${base}^{commit}" >/dev/null 2>&1; then
  printf 'api=true\nweb=true\nstore=true\nadmin=true\ninfra=true\n'
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

shared_web=(web/angular.json web/package.json web/package-lock.json web/tsconfig.json web/projects/shared web/Dockerfile web/.dockerignore web/proxy.conf.cjs)
shared_runtime=(infra/compose.dev.yml infra/compose.dev.apps.yml infra/compose.prod.yml infra/compose.edge.yml .github/workflows)
changed api api "${shared_runtime[@]}" ':(exclude)api/docs/**' ':(exclude)api/README.md'
store=$(changed store web/projects/store "${shared_web[@]}" "${shared_runtime[@]}")
admin=$(changed admin web/projects/admin web/nginx-admin.conf "${shared_web[@]}" "${shared_runtime[@]}")
if [[ $store == store=true || $admin == admin=true ]]; then printf 'web=true\n'; else printf 'web=false\n'; fi
printf '%s\n' "$store" "$admin"
changed infra infra .github/workflows
