# Multi-stage Dockerfile for building Vite React app and serving with nginx
FROM node:18-alpine AS build
WORKDIR /app

# Install dependencies (use package-lock.json if present)
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --silent; else npm install --silent; fi

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Use provided nginx.conf if present
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
