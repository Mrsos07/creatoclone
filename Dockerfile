# Robust multi-stage Dockerfile for Vite + React + Node API
# Uses Debian-based Node image to avoid native/alpine runtime issues

FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Ensure system build tools are available for packages that require compilation
COPY package.json package-lock.json ./
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 python3-dev build-essential ca-certificates wget gnupg dirmngr \
	&& rm -rf /var/lib/apt/lists/* \
	&& npm config set unsafe-perm true \
	&& NPM_CONFIG_LEGACY_PEER_DEPS=true npm ci --unsafe-perm --legacy-peer-deps --silent || \
		 (echo "npm ci failed, printing npm-debug.log if present:" && [ -f npm-debug.log ] && cat npm-debug.log || true) 

# Copy sources and build static assets
COPY . .
RUN npm run build

# Prune dev deps to keep node_modules small (optional)
RUN npm prune --production

FROM node:20-bullseye-slim AS runner
WORKDIR /app

# Set runtime env
ENV NODE_ENV=production

# Copy only production deps from builder (pruned node_modules)
COPY --from=builder /app/node_modules ./node_modules

# Copy built assets and server entrypoint
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY package.json ./package.json

# Expose port (Render provides PORT env automatically)
ENV PORT=10000
EXPOSE 10000

# Start the single Node process that serves API + static frontend
CMD ["node", "server.js"]
