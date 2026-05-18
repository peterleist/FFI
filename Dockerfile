# ── Stage 1: dependencies ──────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: builder ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client before building
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
# DATABASE_URL not needed at build time (only runtime), but Prisma config needs it
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
RUN npm run build

# ── Stage 3: runner ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Include the generated Prisma client (needed at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma /app/node_modules/@prisma

# Prisma 7 uses pg adapter — copy pg driver to standalone node_modules
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg /app/node_modules/pg
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-types /app/node_modules/pg-types
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pgpass /app/node_modules/pgpass
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-pool /app/node_modules/pg-pool
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-protocol /app/node_modules/pg-protocol
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-connection-string /app/node_modules/pg-connection-string

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
