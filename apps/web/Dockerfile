# Aplicația web (panoul comisiei + pagina publică), servită static de nginx.
FROM node:22-alpine AS build
WORKDIR /repo
COPY . .
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
RUN npm ci -w @evoting/crypto -w @evoting/api -w @evoting/web --include-workspace-root \
 && npm run build -w @evoting/crypto -w @evoting/api -w @evoting/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
