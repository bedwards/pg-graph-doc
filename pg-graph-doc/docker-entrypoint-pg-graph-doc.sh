#!/usr/bin/env bash
set -e

# Define pg_cron configuration as string
CONFIG_SHARED_PRELOAD="pg_documentdb_core,pg_documentdb,pg_cron"
CONFIG_CRON_DB="postgres"

# For initialization phase
export POSTGRES_INITDB_ARGS="-c shared_preload_libraries=${CONFIG_SHARED_PRELOAD} -c cron.database_name=${CONFIG_CRON_DB}"

# For runtime phase
exec docker-entrypoint.sh "$@" \
    -c "shared_preload_libraries=${CONFIG_SHARED_PRELOAD}" \
    -c "cron.database_name=${CONFIG_CRON_DB}"
