# ─── Stage 1: deps ───────────────────────────────────────────────────────────
# Install production + dev dependencies so we can build.
FROM node:20-alpine AS deps
WORKDIR /app

# Install libc compat for native modules on Alpine
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Clean install — respects package-lock.json exactly
RUN npm ci

# ─── Stage 2: builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (postinstall runs automatically on npm ci,
# but we repeat here explicitly so the builder stage always has it)
RUN npx prisma generate

# Build-time env vars that must be baked into the Next.js bundle.
# These are NOT secrets — they're public values embedded in client JS.
# Pass them via --build-arg during `docker build` or set them in CI.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SITE_NAME="SaaS Reviews"
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_PLAUSIBLE_DOMAIN

ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_PLAUSIBLE_DOMAIN=$NEXT_PUBLIC_PLAUSIBLE_DOMAIN

# DATABASE_URL is needed at build time only if your build queries the DB
# (e.g. generateStaticParams). Set it here if so; otherwise it's runtime-only.
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# Disable Next.js telemetry inside CI/Docker
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── Stage 3: runner ─────────────────────────────────────────────────────────
# Minimal production image — no dev deps, no source files.
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy only what the server needs at runtime
COPY --from=builder /app/public           ./public
COPY --from=builder /app/prisma           ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Next.js standalone output bundles the server + its node_modules subset.
# Enable it in next.config.ts: output: "standalone"
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run Prisma migrations then start the server.
# In production you'll usually run migrations in a separate init container
# or CI step — but this works well for single-container deployments.
CMD ["node", "server.js"]
