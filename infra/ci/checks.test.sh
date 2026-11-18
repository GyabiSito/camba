#!/usr/bin/env bash
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd -P)
base_tmp=$(cd "${TMPDIR:-/tmp}" && pwd -P)
scratch=$(mktemp -d "$base_tmp/camba-ci.XXXXXXXX")
case "$(realpath "$scratch")" in
  "$base_tmp"/camba-ci.*) trap 'rm -rf -- "$scratch"' EXIT ;;
  *) exit 1 ;;
esac

(
  cd "$scratch"
  git init -q
  git config user.email test@example.invalid
  git config user.name Camba-CI-Test
  git commit -qm base --allow-empty
  base=$(git rev-parse HEAD)
  mkdir api docs
  printf 'docs\n' > docs/readme.md
  git add docs && git commit -qm docs
  test "$(bash "$here/changes.sh" "$base" HEAD)" = $'api=false\nweb=false\ninfra=false'
  base=$(git rev-parse HEAD)
  printf 'api\n' > api/marker
  git add api && git commit -qm api
  test "$(bash "$here/changes.sh" "$base" HEAD)" = $'api=true\nweb=false\ninfra=false'
  test "$(bash "$here/changes.sh" 0000000000000000000000000000000000000000 HEAD)" = $'api=true\nweb=true\ninfra=true'
  ! bash "$here/changes.sh" "$base" missing-head >/dev/null 2>&1
)

for changes in success failure cancelled skipped; do
  for needed in true false ''; do
    for result in success failure cancelled skipped ''; do
      actual=0
      CHANGE_RESULT=$changes API_NEEDED=$needed API_RESULT=$result WEB_NEEDED=false WEB_RESULT=skipped \
        INFRA_NEEDED=false INFRA_RESULT=skipped bash "$here/required.sh" >/dev/null 2>&1 || actual=$?
      if [[ "$changes" == success && ( "$needed:$result" == true:success || "$needed:$result" == false:skipped ) ]]; then
        test "$actual" -eq 0
      else
        test "$actual" -ne 0
      fi
    done
  done
done
printf 'CI scope probes and 60 required-gate combinations passed.\n'
