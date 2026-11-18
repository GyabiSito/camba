#!/usr/bin/env bash
set -euo pipefail

test "$CHANGE_RESULT" = success
check() {
  case "$1:$2" in
    true:success|false:skipped) return 0 ;;
    *) echo "Unexpected result for $3: $1:$2" >&2; return 1 ;;
  esac
}
check "$API_NEEDED" "$API_RESULT" api
check "$WEB_NEEDED" "$WEB_RESULT" web
check "$INFRA_NEEDED" "$INFRA_RESULT" infra
