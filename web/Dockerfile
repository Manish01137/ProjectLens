# ProjectLens website. Build from the repo root: docker build -f web/Dockerfile .
FROM node:22-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY web/prisma web/prisma
COPY web/scripts web/scripts
RUN npm ci

FROM deps AS build
COPY web web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm --workspace web run build

FROM node:22-slim AS run
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build /app /app
RUN useradd --create-home app && mkdir -p /data && chown -R app /app /data
USER app
WORKDIR /app/web
EXPOSE 3000
# Create/upgrade the schema, then serve.
CMD ["sh", "-c", "node scripts/prisma.mjs db push --skip-generate && npx next start --port ${PORT}"]
