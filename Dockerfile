# ==========================================
# Dockerfile para Campaña #VOY CON EL KZ
# ==========================================
# Imagen base ligera Debian (evita incompatibilidades de musl con Tailwind/Oxide en Alpine)
FROM node:22-slim
WORKDIR /app

# Instalar dependencias de producción del backend
COPY package*.json ./
RUN npm install --omit=dev

# Copiar código del servidor backend
COPY server/ ./server/

# Copiar cliente web compilado
COPY client/dist/ ./client/dist/

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=5000

# Puerto expuesto por el contenedor
EXPOSE 5000

# Comando de inicio del servidor
CMD ["node", "server/index.js"]
