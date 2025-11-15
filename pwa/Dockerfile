# ===========================================================================
# Dockerfile - PWA Frontend (Santé Rurale)
# ===========================================================================
# Multi-stage build pour développement et production
# ===========================================================================

# ===========================================================================
# Stage 1: Base - Dépendances Node.js
# ===========================================================================
FROM node:18-alpine AS base

WORKDIR /app

# Installer les dépendances système nécessaires
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++

# Copier les fichiers de dépendances
COPY package.json package-lock.json ./

# ===========================================================================
# Stage 2: Development - Pour docker-compose.dev.yml
# ===========================================================================
FROM base AS development

# Installer TOUTES les dépendances (incluant devDependencies)
RUN npm ci

# Copier tout le code source
COPY . .

# Exposer le port Vite (5173)
EXPOSE 5173

# Configurer Vite pour accepter les connexions depuis n'importe quelle interface
# Nécessaire pour Docker networking
ENV VITE_HOST=0.0.0.0
ENV VITE_PORT=5173

# Lancer le serveur de développement avec hot reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ===========================================================================
# Stage 3: Build - Compiler l'application pour production
# ===========================================================================
FROM base AS builder

# Installer TOUTES les dépendances (incluant devDependencies pour le build)
RUN npm ci

# Copier tout le code source
COPY . .

# Build de production (génère /app/dist)
RUN npm run build

# ===========================================================================
# Stage 4: Production - Servir avec Nginx
# ===========================================================================
FROM nginx:1.25-alpine AS production

# Copier la configuration Nginx optimisée pour PWA
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Compression gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/x-javascript application/xml+rss
               application/javascript application/json
               application/manifest+json;

    # Cache statique (hachés par Vite)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Service Worker - pas de cache
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # Web App Manifest - pas de cache
    location = /manifest.json {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Toutes les routes -> index.html (React Router SPA)
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, must-revalidate";
    }

    # Headers de sécurité
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Content Security Policy (CSP)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.sante-rurale.ml http://localhost:8000;" always;
}
EOF

# Copier les fichiers buildés depuis le stage builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Vérifier que les fichiers sont bien copiés
RUN ls -lah /usr/share/nginx/html

# Exposer le port 80
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Lancer Nginx
CMD ["nginx", "-g", "daemon off;"]

# ===========================================================================
# UTILISATION:
# ===========================================================================
#
# Développement (avec hot reload):
#   docker build --target development -t sante-rurale-pwa:dev .
#   docker run -p 5173:5173 -v $(pwd):/app sante-rurale-pwa:dev
#
# Production (avec Nginx):
#   docker build --target production -t sante-rurale-pwa:prod .
#   docker run -p 80:80 sante-rurale-pwa:prod
#
# ===========================================================================
