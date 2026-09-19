# High-Performance Node.js Production Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Final Runtime Image
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Copy node modules and source
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Run as non-root user for security
USER node

EXPOSE 4000

# Start with Cluster Load Balancer for multi-core scaling
CMD ["node", "src/cluster.js"]
