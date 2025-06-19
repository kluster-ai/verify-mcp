FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built application
COPY dist/ ./dist/

# Expose port 3001
EXPOSE 3001

# Set entrypoint
ENTRYPOINT ["node", "dist/index.js"]

# Default to help if no args provided
CMD ["--help"]