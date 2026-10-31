# Imaginea backend-ului și a panoului web, construite din monorepo.
#   docker compose up --build

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/crypto/package.json packages/crypto/
COPY packages/api/package.json packages/api/
COPY apps/backend/package.json apps/backend/
COPY apps/web/package.json apps/web/
COPY tools/trustee/package.json tools/trustee/
COPY tools/verifier/package.json tools/verifier/
COPY demos/package.json demos/
RUN npm ci --ignore-scripts
COPY packages packages
COPY apps/backend apps/backend
COPY apps/web apps/web
COPY tools tools
COPY demos demos
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w @evoting/crypto -w @evoting/api \
 && npm run build -w @evoting/backend -w @evoting/trustee -w @evoting/verifier \
 && cd apps/web && npx vite build

FROM node:22-alpine AS backend
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM nginx:1.27-alpine AS web
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location / { try_files $uri /index.html; }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
