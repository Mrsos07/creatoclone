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

# Install envsubst for runtime substitution of $PORT
RUN apk add --no-cache gettext

COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx template and substitute $PORT at container start
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template

EXPOSE 80
CMD ["sh", "-c", "PORT=${PORT:-80}; envsubst '$$PORT' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
