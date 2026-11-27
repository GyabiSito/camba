#!/usr/bin/env bash
set -euo pipefail

src=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
work=$(mktemp -d)
trap 'case "$work" in /tmp/tmp.*) rm -r -- "$work";; esac' EXIT
mkdir "$work/bin" "$work/state"
touch "$work/runtime.env" "$work/compose.yml"
export CAMBA_RELEASE_DIR="$work/state" CAMBA_RUNTIME_ENV_FILE="$work/runtime.env" CAMBA_COMPOSE_FILE="$work/compose.yml"
export CAMBA_COMPOSE_PROJECT=camba-prod
export DOCKER_LOG="$work/docker.log" PATH="$work/bin:$PATH"
unset FAIL_NEXT_UP HOLD_STORE_UP

cat >"$work/bin/docker" <<'FAKE'
#!/usr/bin/env bash
set -euo pipefail
test "$1" = compose
shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) version_file=$2; shift 2;;
    --project-name) test "$2" = "${EXPECTED_DOCKER_PROJECT:-$CAMBA_COMPOSE_PROJECT}"; shift 2;;
    -f) shift 2;;
    *) break;;
  esac
done
printf '%s | %s\n' "$*" "$(grep '^CAMBA_.*_IMAGE=' "$version_file" | tr '\n' ' ')" >> "$DOCKER_LOG"
if [[ $1 = up && -n ${FAIL_NEXT_UP:-} && ! -e $FAIL_NEXT_UP ]]; then
  touch "$FAIL_NEXT_UP"
  exit 1
fi
if [[ $1 = up && ${!#} = store && -n ${HOLD_STORE_UP:-} ]]; then
  touch "$HOLD_STORE_UP.ready"
  for _ in {1..200}; do
    [[ -e $HOLD_STORE_UP.release ]] && exit 0
    sleep .025
  done
  exit 1
fi
FAKE
chmod u+x "$work/bin/docker"

ref() {
  printf 'ghcr.io/example/camba-%s@sha256:%064x' "$1" "$2"
}
api=$(ref api 11)
store=$(ref store 11)
admin=$(ref admin 11)
store2=$(ref store 12)
api2=$(ref api 13)
apply() { bash "$src/apply.sh" "$@"; }

if (unset CAMBA_COMPOSE_PROJECT; apply 11 "api=$api" "store=$store" "admin=$admin") >"$work/no-project" 2>&1; then exit 1; fi
grep -q 'Set the approved Compose project explicitly' "$work/no-project"
test ! -e "$DOCKER_LOG"

# Keep the previous release entry point working while its legacy Compose file stays installed.
mkdir "$work/legacy-state"
printf 'name: camba-v2\n' >"$work/legacy-compose.yml"
(
  unset CAMBA_COMPOSE_PROJECT
  export CAMBA_COMPOSE_FILE="$work/legacy-compose.yml" CAMBA_RELEASE_DIR="$work/legacy-state"
  export DOCKER_LOG="$work/legacy-docker.log" EXPECTED_DOCKER_PROJECT=camba-v2
  apply 11 "api=$api" "store=$store" "admin=$admin"
)
grep -q '^up ' "$work/legacy-docker.log"

apply 11 "api=$api" "store=$store" "admin=$admin"
grep -q '^pull api api-fpm worker scheduler store admin |' "$DOCKER_LOG"
grep -q '^--profile release run --rm --no-deps migrate |' "$DOCKER_LOG"
grep -q '^up -d --no-deps --wait --wait-timeout 120 api api-fpm worker scheduler store admin |' "$DOCKER_LOG"
grep -qx "CAMBA_API_IMAGE=$api" "$CAMBA_RELEASE_DIR/current.env"

feed_count=$(wc -l < "$DOCKER_LOG")
apply 10 "api=$api"
test "$feed_count" -eq "$(wc -l < "$DOCKER_LOG")"

> "$DOCKER_LOG"
apply 12 "store=$store2"
grep -q '^pull store |' "$DOCKER_LOG"
grep -q '^up -d --no-deps --wait --wait-timeout 120 store |' "$DOCKER_LOG"
! grep -qE '^(--profile release|pull api|up .*admin) ' "$DOCKER_LOG"
grep -qx "CAMBA_API_IMAGE=$api" "$CAMBA_RELEASE_DIR/current.env"
grep -qx "CAMBA_STORE_IMAGE=$store" "$CAMBA_RELEASE_DIR/previous.env"

> "$DOCKER_LOG"
export FAIL_NEXT_UP="$work/fail-once"
if apply 13 "api=$api2"; then exit 1; fi
test "$(grep -c '^up .* api api-fpm worker scheduler |' "$DOCKER_LOG")" -eq 2
grep '^up ' "$DOCKER_LOG" | tail -n 1 | grep -Fq "CAMBA_API_IMAGE=$api "
grep -qx "CAMBA_API_IMAGE=$api" "$CAMBA_RELEASE_DIR/current.env"

feed_count=$(wc -l < "$DOCKER_LOG")
if apply 14 'api=ghcr.io/example/camba-api:latest'; then exit 1; fi
test "$feed_count" -eq "$(wc -l < "$DOCKER_LOG")"

unset FAIL_NEXT_UP
export HOLD_STORE_UP="$work/hold"
store3=$(ref store 14)
admin2=$(ref admin 15)
apply 14 "store=$store3" &
first=$!
for _ in {1..200}; do
  [[ -f $HOLD_STORE_UP.ready ]] && break
  sleep .025
done
test -f "$HOLD_STORE_UP.ready"
apply 15 "admin=$admin2" &
second=$!
sleep .2
if grep -q '^pull admin |' "$DOCKER_LOG"; then
  touch "$HOLD_STORE_UP.release"
  wait "$first" "$second" || true
  exit 1
fi
touch "$HOLD_STORE_UP.release"
wait "$first" "$second"
grep -qx "CAMBA_STORE_IMAGE=$store3" "$CAMBA_RELEASE_DIR/current.env"
grep -qx "CAMBA_ADMIN_IMAGE=$admin2" "$CAMBA_RELEASE_DIR/current.env"
printf 'selective release, concurrent lock, stale skip, rollback, and input validation passed\n'
