# ==========================================
# SKILLQUEST BACKEND - DOCKERFILE
# ==========================================

# 1. Base Image: Use lightweight Node 18 Alpine
FROM node:18-alpine

# 2. Set environment to production
ENV NODE_ENV=production

# 3. Create app directory
WORKDIR /app

# 4. Install app dependencies
# Copy package.json and package-lock.json first to leverage caching
COPY package*.json ./
RUN npm ci --omit=dev

# 5. Bundle app source
COPY . .

# 6. Expose the port Express server runs on (default: 5000)
EXPOSE 5000

# 7. Start command
CMD ["node", "server.js"]
