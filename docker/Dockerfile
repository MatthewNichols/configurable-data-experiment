# syntax=docker/dockerfile:1.7-labs
# One image per customer install: `docker build --build-arg CUSTOMER=acme -f docker/Dockerfile .`
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# dependency layer (cached until a package.json or the lockfile changes)
COPY --parents package.json yarn.lock packages/*/package.json modules/*/package.json ./
RUN yarn install --frozen-lockfile --network-timeout 600000 && yarn cache clean

COPY . .
ARG CUSTOMER
RUN test -n "$CUSTOMER" || (echo "Build with --build-arg CUSTOMER=<name>" && exit 1)
ENV CUSTOMER=$CUSTOMER NODE_ENV=production PORT=3000
# assemble: registry, Prisma schema + client, module indexes, web bundle
RUN yarn cde build "$CUSTOMER" --web

EXPOSE 3000
CMD ["sh", "-c", "exec node_modules/.bin/tsx customers/$CUSTOMER/.cde/main.ts serve"]
