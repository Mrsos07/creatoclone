# Multi-stage Dockerfile for building Vite React app and serving with nginx
FROM node:18-bullseye AS build
WORKDIR /app

# Install build tools (some dependencies may require compilation)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies and build
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --silent; else npm install --silent; fi
COPY . .
RUN npm run build

# Production image: run a Node server that serves static files and API
FROM node:18-bullseye
WORKDIR /app
COPY package*.json ./
# install ffmpeg runtime and necessary tools
RUN apt-get update && apt-get install -y ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
# Copy node_modules and built assets from build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
EXPOSE 3000
ENV NODE_ENV=production
CMD [ "node", "server/index.js" ]
