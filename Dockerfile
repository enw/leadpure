# Stage 1: Install deps + build
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy workspace manifests
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY apps/web/tsconfig.json apps/web/tsconfig.json
COPY packages/core/package.json packages/core/package.json
COPY apps/worker/package.json apps/worker/package.json

# Install all deps
RUN bun install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY packages/core/ packages/core/
COPY apps/web/ apps/web/
COPY apps/worker/ apps/worker/
COPY scripts/ scripts/

# Build Next.js standalone
RUN cd apps/web && NODE_ENV=production bun run build

# Stage 2: Runtime
FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SELF_HOST=true

# Copy standalone build
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY scripts/ ./scripts/

EXPOSE 3000

CMD ["bun", "run", "apps/web/server.js"]
