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
RUN npm ci --production --silent
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
EXPOSE 3000
ENV NODE_ENV=production
CMD [ "node", "server/index.js" ]
