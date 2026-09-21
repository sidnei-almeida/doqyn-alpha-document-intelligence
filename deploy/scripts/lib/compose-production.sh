#!/usr/bin/env bash
# Wrapper docker compose para produção — profile local-mongo quando não usa Atlas.
# Uso: source este arquivo após carregar deploy/.env

storage_mirror_profile_enabled() {
  local enabled="${STORAGE_MIRROR_ENABLED:-false}"
  enabled="$(printf '%s' "$enabled" | tr '[:upper:]' '[:lower:]')"
  [[ "$enabled" == "true" || "$enabled" == "1" ]]
}

# MinIO (e qualquer outro serviço do profile `mirror`) só entra no projeto quando
# o espelho está ligado. Sem isto, STORAGE_MIRROR_ENABLED=true enfileiraria jobs
# contra um endpoint que o Compose nunca sobe.
compose_append_mirror_profile() {
  local -n __compose_cmd=$1
  if storage_mirror_profile_enabled; then
    __compose_cmd+=(--profile mirror)
  fi
}

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
  compose_append_mirror_profile cmd

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
  compose_append_mirror_profile cmd
  cmd+=(--profile observability)
  cmd+=("$@")
  "${cmd[@]}"
}

is_mongodb_atlas_deploy() {
  [[ "${MONGODB_USE_ATLAS:-false}" == "true" ]]
}
