#!/bin/sh
set -eu
# Use the Pod's resolver (also works with GKE NodeLocal DNS and local Docker).
RUNTIME_DNS_RESOLVER="$(awk '/^nameserver / { print $2; exit }' /etc/resolv.conf)"
case "$RUNTIME_DNS_RESOLVER" in *:*) RUNTIME_DNS_RESOLVER="[$RUNTIME_DNS_RESOLVER]" ;; esac
export RUNTIME_DNS_RESOLVER
# Only substitute our two variables; keep nginx's own $host/$runtime_status intact.
POD_NAMESPACE="${POD_NAMESPACE:-default}"
export POD_NAMESPACE
envsubst '${POD_NAMESPACE} ${RUNTIME_DNS_RESOLVER}' < /etc/nginx/templates/default.conf.template > /tmp/runtime-default.conf
# The App Chart makes /etc read-only. Both generated configs belong on the /tmp volume.
sed 's|/etc/nginx/conf.d/\*.conf|/tmp/runtime-default.conf|' /etc/nginx/nginx.conf > /tmp/runtime-nginx.conf
