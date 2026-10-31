# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency files and install production dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy project files
COPY . .

# Build application
RUN npm run build

# Serve stage using NGINX
FROM nginx:alpine

# Copy built assets to NGINX
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom NGINX configuration for SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
