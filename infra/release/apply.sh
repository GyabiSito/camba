#!/usr/bin/env bash
set -euo pipefail
umask 077

fail() { printf 'camba release: %s\n' "$*" >&2; exit 1; }
valid_sequence() { [[ $1 =~ ^[1-9][0-9]{0,11}$ ]]; }
valid_image() { [[ $1 =~ ^[a-z0-9.-]+(:[0-9]{1,5})?(/[a-z0-9._-]+)+@sha256:[0-9a-f]{64}$ ]]; }

sequence=${1:-}
valid_sequence "$sequence" || fail 'a positive CI release sequence is required'
shift
(( $# > 0 )) || fail 'at least one component=digest is required'

state_dir=${CAMBA_RELEASE_DIR:?Set CAMBA_RELEASE_DIR to a protected, persistent directory}
env_file=${CAMBA_RUNTIME_ENV_FILE:?Set CAMBA_RUNTIME_ENV_FILE to protected runtime configuration}
compose_file=${CAMBA_COMPOSE_FILE:?Set CAMBA_COMPOSE_FILE to the installed Compose file}
project=${CAMBA_COMPOSE_PROJECT:-camba-v2}
[[ $state_dir = /* && $env_file = /* && $compose_file = /* ]] || fail 'release and configuration paths must be absolute'
[[ -d $state_dir && -f $env_file && -r $compose_file ]] || fail 'release state, runtime configuration, or Compose file unavailable'
cd -- "$state_dir"
state_dir=$(pwd -P)
exec {lock_fd}>"$state_dir/.release.lock"
flock -w 120 "$lock_fd" || fail 'another release holds the lock'

declare -A requested images sequences
components=(api store admin)
current="$state_dir/current.env"
previous="$state_dir/previous.env"
for entry in "$@"; do
  kind=${entry%%=*}
  ref=${entry#*=}
  case "$kind" in api|store|admin) ;; *) fail 'unknown release component';; esac
  valid_image "$ref" || fail "invalid immutable image for $kind"
  [[ -z ${requested[$kind]:-} ]] || fail "duplicate $kind"
  requested[$kind]=$ref
done

if [[ -e $current ]]; then
  while IFS='=' read -r key value; do
    case "$key" in
      CAMBA_API_IMAGE|CAMBA_STORE_IMAGE|CAMBA_ADMIN_IMAGE)
        kind=${key#CAMBA_}; kind=${kind%_IMAGE}; kind=${kind,,}
        [[ -z ${images[$kind]:-} ]] && valid_image "$value" || fail 'current manifest contains an invalid image'
        images[$kind]=$value
        ;;
      CAMBA_API_SEQUENCE|CAMBA_STORE_SEQUENCE|CAMBA_ADMIN_SEQUENCE)
        kind=${key#CAMBA_}; kind=${kind%_SEQUENCE}; kind=${kind,,}
        [[ -z ${sequences[$kind]:-} ]] && valid_sequence "$value" || fail 'current manifest contains an invalid sequence'
        sequences[$kind]=$value
        ;;
      *) fail 'current manifest contains an unexpected field';;
    esac
  done < "$current"
  for kind in "${components[@]}"; do
    [[ -n ${images[$kind]:-} && -n ${sequences[$kind]:-} ]] || fail 'current manifest is incomplete'
  done
fi

services=()
api_changed=false
for kind in "${components[@]}"; do
  ref=${requested[$kind]:-}
  [[ -n $ref ]] || continue
  old_sequence=${sequences[$kind]:-0}
  if (( sequence < old_sequence )); then
    printf 'Ignored stale %s release %s\n' "$kind" "$sequence"
    continue
  fi
  if (( sequence == old_sequence )); then
    [[ $ref == "${images[$kind]}" ]] || fail "release sequence already points at another $kind digest"
    continue
  fi
  images[$kind]=$ref
  sequences[$kind]=$sequence
  case "$kind" in
    api) api_changed=true; services+=(api api-fpm worker scheduler);;
    *) services+=("$kind");;
  esac
done
(( ${#services[@]} > 0 )) || exit 0
for kind in "${components[@]}"; do
  [[ -n ${images[$kind]:-} ]] || fail 'first release must supply api, store, and admin'
done

next=$(mktemp "$state_dir/.next.XXXXXXXX")
old=$(mktemp "$state_dir/.old.XXXXXXXX")
trap 'rm -f -- "$next" "$old"' EXIT
if [[ -f $current ]]; then cp -- "$current" "$old"; fi
for kind in "${components[@]}"; do
  printf 'CAMBA_%s_IMAGE=%s\nCAMBA_%s_SEQUENCE=%s\n' "${kind^^}" "${images[$kind]}" "${kind^^}" "${sequences[$kind]}" >>"$next"
done

compose() (
  local manifest=$1
  shift
  # Only the validated manifest controls image selection. Do not source runtime secrets.
  unset CAMBA_API_IMAGE CAMBA_STORE_IMAGE CAMBA_ADMIN_IMAGE
  docker compose --project-name "$project" --env-file "$env_file" --env-file "$manifest" -f "$compose_file" "$@"
)

compose "$next" config --quiet
compose "$next" pull "${services[@]}"
if $api_changed; then
  compose "$next" --profile release run --rm --no-deps migrate
fi
if ! compose "$next" up -d --no-deps --wait --wait-timeout 120 "${services[@]}"; then
  if [[ -s $old ]]; then
    compose "$old" up -d --no-deps --wait --wait-timeout 120 "${services[@]}" ||
      fail 'update and automatic image rollback failed; use the recorded current manifest'
    fail 'update failed; previous images restored, schema not reverted'
  fi
  fail 'first release did not become healthy; no manifest recorded, inspect the isolated services'
fi
if [[ -s $old ]]; then mv -f -- "$old" "$previous"; fi
mv -f -- "$next" "$current"
printf 'Applied release %s to: %s\n' "$sequence" "${services[*]}"
