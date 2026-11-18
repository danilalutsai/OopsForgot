#!/usr/bin/env bash
# Prints the database's IPv4 connection URL (Supabase's session pooler). GitHub runners have no
# IPv6, and the direct database address is IPv6 only. Needs PROJECT_REF and SUPABASE_DB_PASSWORD.
set -euo pipefail

# the project's pooler (Frankfurt); shown in Supabase under Connect → Session pooler
host="${POOLER_HOST:-aws-1-eu-central-1.pooler.supabase.com}"
password=$(jq -rn --arg p "$SUPABASE_DB_PASSWORD" '$p | @uri')
# port 5432 is session mode, which pg_dump and migrations need
echo "postgresql://postgres.$PROJECT_REF:$password@$host:5432/postgres"
