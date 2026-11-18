#!/usr/bin/env bash
set -euo pipefail
export MSYS_NO_PATHCONV=1

component=${1:?api, store or admin required}
image=${2:?image tag required}
case "$component" in
  api) docker build --tag "$image" api;;
  store|admin) docker build --target "$component" --tag "$image" web;;
  *) printf 'Unknown image component\n' >&2; exit 1;;
esac

if [[ $component == api ]]; then
  docker run --rm --entrypoint php "$image" -r 'foreach (["pdo_mysql", "redis", "gd", "exif", "zip"] as $name) if (!extension_loaded($name)) exit(1);'
  docker run --rm --entrypoint nginx "$image" -t -c /etc/nginx/camba.conf
else
  container=$(docker run --detach --read-only --tmpfs /tmp --network none "$image")
  trap 'docker rm -f "$container" >/dev/null' EXIT
  if [[ $component == store ]]; then
    probe=(node -e "fetch('http://127.0.0.1:4000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))")
  else
    probe=(wget -q -O /dev/null http://127.0.0.1:8080/healthz)
  fi
  for attempt in {1..20}; do
    if docker exec "$container" "${probe[@]}" >/dev/null 2>&1; then exit 0; fi
    sleep 1
  done
  docker logs "$container"
  exit 1
fi
