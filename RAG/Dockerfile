# ============================================================
# SellBot RAG — React Frontend
# Two-stage build: Node builds the app, Nginx serves it
# ============================================================

# ---------- Stage 1: Build ----------
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first (Docker layer caching — faster rebuilds)
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# VITE_API_BASE_URL tells the frontend where the backend lives.
# Passed in at build time by Railway as an environment variable.
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Compile TypeScript + bundle with Vite → outputs to /app/dist/
RUN npm run build

# ---------- Stage 2: Serve ----------
# Use lightweight Nginx to serve the compiled static files.
# Final image is ~25 MB instead of ~1 GB (no Node.js in production).
FROM nginx:alpine

# Copy compiled frontend from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx config: serve files, and handle React Router (SPA routing).
# Without this, refreshing a page like /chat gives 404 from Nginx.
RUN printf 'server {\n\
    listen 80;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
