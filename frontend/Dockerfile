# ==========================================
# SKILLQUEST FRONTEND - DOCKERFILE
# ==========================================

# --- Stage 1: Build the React Application ---
FROM node:18-alpine AS build

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies (including devDependencies needed for build)
RUN npm ci

# Copy application files
COPY . .

# Set Build-time Arguments (overridden via docker-compose build --build-arg)
ARG VITE_BACKEND_URL
ARG VITE_API_URL

# Set environment variables for Vite compiler
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_API_URL=$VITE_API_URL

# Compile the production bundle
RUN npm run build

# --- Stage 2: Serve the Built Assets via Nginx ---
FROM nginx:alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output to Nginx default public folder
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80 (standard HTTP port)
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
