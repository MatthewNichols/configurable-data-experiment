#!/bin/sh
# Runs as the one-shot `migrate` service: apply the customer's committed migrations, then seed an empty DB.
set -e
node_modules/.bin/prisma migrate deploy --config "customers/$CUSTOMER/.cde/prisma.config.ts"
exec node --enable-source-maps "customers/$CUSTOMER/.cde/main.mjs" seed
