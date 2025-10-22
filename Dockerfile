# Use Node.js 22 LTS (active support until October 2027)
FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Expose port (Cloud Run will set PORT env var)
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
