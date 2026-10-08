# ==========================================
# Multi-stage Dockerfile para Campaña #VOY CON EL KZ
# ==========================================

# Etapa 1: Compilar Frontend (React + Vite + Tailwind)
FROM node:22-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# Etapa 2: Servidor Backend de Producción
FROM node:22-alpine AS runner
WORKDIR /app

# Instalar dependencias de producción
COPY package*.json ./
RUN npm install --omit=dev

# Copiar código del servidor y cliente compilado
COPY server/ ./server/
COPY --from=client-builder /app/client/dist ./client/dist

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=5000
ENV JWT_SECRET=campana_kz_secret_key_2026

# Puerto expuesto
EXPOSE 5000

# Comando de inicio
CMD ["node", "server/index.js"]
