#!/usr/bin/env bash
# Wrapper docker compose para produção — profile local-mongo quando não usa Atlas.
# Uso: source este arquivo após carregar deploy/.env

compose_production() {
  local deploy_dir="$1"
  shift
  local compose_file="$deploy_dir/docker-compose.production.yml"
  local env_file="$deploy_dir/.env"

  local -a cmd
  if docker compose version >/dev/null 2>&1; then
    cmd=(docker compose -f "$compose_file" --env-file "$env_file")
  else
    cmd=(docker-compose -f "$compose_file" --env-file "$env_file")
  fi

  if [[ "${MONGODB_USE_ATLAS:-false}" != "true" ]]; then
    cmd+=(--profile local-mongo)
  fi

  cmd+=("$@")
  "${cmd[@]}"
}

# Stack principal + profile observability (Prometheus, Grafana, redis-exporter).
compose_production_observability() {
  local deploy_dir="$1"
  shift
  local compose_file="$deploy_dir/docker-compose.production.yml"
  local env_file="$deploy_dir/.env"

  local -a cmd
  if docker compose version >/dev/null 2>&1; then
    cmd=(docker compose -f "$compose_file" --env-file "$env_file")
  else
    cmd=(docker-compose -f "$compose_file" --env-file "$env_file")
  fi

  if [[ "${MONGODB_USE_ATLAS:-false}" != "true" ]]; then
    cmd+=(--profile local-mongo)
  fi
  cmd+=(--profile observability)
  cmd+=("$@")
  "${cmd[@]}"
}

is_mongodb_atlas_deploy() {
  [[ "${MONGODB_USE_ATLAS:-false}" == "true" ]]
}
