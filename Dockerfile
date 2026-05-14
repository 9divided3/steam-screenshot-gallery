# Stage 1: Build client
FROM node:22-slim AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Production
FROM node:22-slim
RUN addgroup --gid 1001 appuser && adduser --uid 1001 --gid 1001 --gecos '' --disabled-password appuser

WORKDIR /app/server

COPY server/package*.json ./
RUN npm install --production

COPY server/ ./
COPY --from=client-builder /app/client/dist ./public
RUN mkdir -p uploads thumbnails data && chown -R appuser:appuser /app/server

USER appuser

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health',(r)=>{process.exit(r.statusCode===200?0:1)})"

CMD ["node", "index.js"]
