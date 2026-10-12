# pg_dump/pg_restore from the same major version as the server (16).
FROM postgres:16-alpine
RUN apk add --no-cache bash curl restic tzdata
COPY lib.sh /usr/local/lib/backup/lib.sh
COPY --chmod=0755 backup-now.sh /usr/local/bin/backup-now
# This image only runs client tools; drop the Postgres server entrypoint.
ENTRYPOINT []
CMD ["backup-now"]
