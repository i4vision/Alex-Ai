# Stage 1: Build the React Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Setup the Backend Monolith
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./
# Copy the compiled React assets into the Node Express public directory
COPY --from=frontend-builder /app/frontend/dist ./public

EXPOSE 28341
CMD ["node", "server.js"]
