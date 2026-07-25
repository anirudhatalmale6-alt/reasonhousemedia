# ---------- Build the frontend ----------
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Same-origin API in production
ENV VITE_API_URL=""
RUN npm run build

# ---------- Backend + serve built frontend ----------
FROM node:22-alpine AS app
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
# bring in the compiled frontend so the API can serve it
COPY --from=web /web/dist /app/frontend/dist

ENV NODE_ENV=production
ENV PORT=4137
# IMPORTANT: set a strong secret at run time:  -e JWT_SECRET=...
EXPOSE 4137
# persist the SQLite db + uploaded images with a volume on /app/backend/data
VOLUME ["/app/backend/uploads"]
CMD ["node", "server.js"]
