# Multi-stage build for a Vite + React app
# Builder: install deps and build static assets
FROM node:20-alpine AS builder
WORKDIR /app

# copy package manifests first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# copy rest of the source and build
COPY . .
RUN npm run build

# Runner: lightweight Node image serving the built `dist` folder using `serve`
FROM node:20-alpine AS runner
WORKDIR /app

# copy production package manifest and install production deps only
COPY package.json package-lock.json ./

# Install production dependencies in the runner image to guarantee availability
RUN npm ci --omit=dev

# copy built assets and server
COPY --from=builder /app/dist ./dist
COPY server.js ./server.js

# default port used by Render is the environment variable PORT
ENV PORT=10000
EXPOSE 10000

# Run the Node server which serves API endpoints and static frontend
CMD ["node", "server.js"]
