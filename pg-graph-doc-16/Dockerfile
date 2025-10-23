FROM ghcr.io/ferretdb/postgres-documentdb:16-0.106.0-ferretdb-2.5.0

ARG PG_MAJOR=16
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl ca-certificates gnupg; \
    install -d /etc/apt/keyrings; \
    curl -fsSL https://repo.pigsty.io/key | gpg --dearmor > /etc/apt/keyrings/pigsty.gpg; \
    echo "deb [signed-by=/etc/apt/keyrings/pigsty.gpg] https://repo.pigsty.io/apt/pgsql/bookworm bookworm main" > /etc/apt/sources.list.d/pigsty-io.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        "postgresql-${PG_MAJOR}-pg-graphql" \
        "postgresql-${PG_MAJOR}-cron" \
        "postgresql-${PG_MAJOR}-postgis-3"; \
    rm -rf /var/lib/apt/lists/*

COPY 01_extensions.sql /docker-entrypoint-initdb.d/

ARG ENTRYPOINT=docker-entrypoint-pg-graph-doc.sh
ARG BIN_DIR=/usr/local/bin
COPY ${ENTRYPOINT} ${BIN_DIR}/
RUN chmod +x ${BIN_DIR}/${ENTRYPOINT}

ENTRYPOINT ["docker-entrypoint-pg-graph-doc.sh"]
CMD ["postgres"]