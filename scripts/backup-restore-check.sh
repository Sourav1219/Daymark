#!/usr/bin/env bash
# Verifies that a database backup restores into a working schema with the
# expected content. Run against any disposable PostgreSQL instance:
#
#   DATABASE_URL=postgresql://user:pass@host:5432/db ./scripts/backup-restore-check.sh
#
# The check dumps the current database, wipes the schema, restores from the
# dump, and compares table counts before and after. It is destructive to the
# target database and must only run against a scratch copy.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point at a disposable PostgreSQL database}"

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

count_snapshot() {
  # Exact per-table counts (pg_stat estimates drift across restore).
  {
    echo "select 'public.' || tablename || '=' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', schemaname, tablename), false, true, '')))[1]::text"
    echo "  from pg_tables where schemaname = 'public' order by tablename \\gexec"
  } | psql "$DATABASE_URL" -tA | sort
}

before="$(count_snapshot)"

list_tables() {
  psql "$DATABASE_URL" -tAc "
    select tablename from pg_tables where schemaname = 'public'
    order by tablename
  "
}

echo "Dumping database..."
pg_dump --format=custom --file="$workdir/backup.dump" "$DATABASE_URL"

echo "Wiping public schema..."
psql "$DATABASE_URL" -q -c "drop schema public cascade; create schema public;"

echo "Restoring from dump..."
pg_restore --dbname="$DATABASE_URL" --no-owner --no-privileges "$workdir/backup.dump"

after="$(count_snapshot)"

echo "Table inventory after restore:"
list_tables

if [ "$before" != "$after" ]; then
  echo "FAIL: table counts changed across restore:" >&2
  diff <(printf '%s\n' "$before") <(printf '%s\n' "$after") >&2 || true
  exit 1
fi

if [ "$(list_tables | wc -l | tr -d '[:space:]')" -lt 20 ]; then
  echo "FAIL: restored schema is missing tables" >&2
  exit 1
fi

echo "PASS: backup restored with identical per-table counts."
echo "$after"
