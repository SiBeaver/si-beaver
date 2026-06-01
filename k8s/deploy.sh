#!/bin/bash
# Apply all k8s manifests to 10.1.1.40 in dependency order.
# Usage: ./k8s/deploy.sh

set -e

HOST="10.1.1.40"
KUBECTL="ssh $HOST sudo kubectl"

echo "=== namespace ==="
$KUBECTL apply -f - < "$(dirname "$0")/namespace.yaml"

echo "=== si-beaver-cloud (API) ==="
$KUBECTL apply -f - < "$(dirname "$0")/deployment.yaml"
$KUBECTL apply -f - < "$(dirname "$0")/service.yaml"

echo "=== sisbc-web (frontend) ==="
$KUBECTL apply -f - < "$(dirname "$0")/deployment-web.yaml"
$KUBECTL apply -f - < "$(dirname "$0")/service-web.yaml"

echo "=== ingress ==="
$KUBECTL apply -f - < "$(dirname "$0")/ingress.yaml"

echo "=== done ==="
