# Multi-stage build for a Vite + React app
# Builder: install deps and build static assets
FROM node:20-alpine AS builder
WORKDIR /app

# copy package manifests first for better layer caching
COPY package.json package-lock.json ./

# install all deps (dev+prod) for building
RUN npm ci

# copy rest of the source and build
COPY . .
RUN npm run build

# remove dev dependencies, keep only production deps in node_modules
RUN npm prune --production

# Runner: lightweight Node image serving the built `dist` folder and API
FROM node:20-alpine AS runner
WORKDIR /app

# copy production node_modules from builder to runner
COPY --from=builder /app/node_modules ./node_modules

# copy built assets and server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js

# default port used by Render is the environment variable PORT
ENV PORT=10000
EXPOSE 10000

# Run the Node server which serves API endpoints and static frontend
CMD ["node", "server.js"]
