# pg_dump/pg_restore from the same major version as the server (16).
FROM postgres:16-alpine
RUN apk add --no-cache bash curl restic tzdata
COPY lib.sh /usr/local/lib/backup/lib.sh
COPY --chmod=0755 backup-now.sh /usr/local/bin/backup-now
COPY --chmod=0755 restore-drill.sh /usr/local/bin/restore-drill
COPY --chmod=0755 entrypoint.sh /usr/local/bin/entrypoint
COPY crontab /etc/crontabs/root
ENTRYPOINT ["/usr/local/bin/entrypoint"]
CMD ["scheduler"]
