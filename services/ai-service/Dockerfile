# ==========================================
# SKILLQUEST AI CONTENT SERVICE - DOCKERFILE
# ==========================================

FROM node:18-alpine

# Set environment to production
ENV NODE_ENV=production

WORKDIR /app

# 1. Copy the shared library first (needed as local dependency)
COPY services/shared /shared
RUN cd /shared && npm install --omit=dev

# 2. Copy the package files for ai-service
COPY services/ai-service/package*.json ./

# 3. Install production dependencies (resolves the local file link)
RUN npm install --omit=dev

# 4. Copy the ai-service source files
COPY services/ai-service/ .

# 5. Expose the port (5005)
EXPOSE 5005

# 6. Start the server
CMD ["node", "server.js"]
