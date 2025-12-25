# Multi-stage Dockerfile for building Vite React app and serving with nginx
FROM node:18-alpine AS build
WORKDIR /app

# Install dependencies and build
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --silent; else npm install --silent; fi
COPY . .
RUN npm run build

# Production image: run a Node server that serves static files and API
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
# Copy node_modules from build stage to avoid running npm ci here (which fails when lockfile missing)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
EXPOSE 3000
ENV NODE_ENV=production
CMD [ "node", "server/index.js" ]
