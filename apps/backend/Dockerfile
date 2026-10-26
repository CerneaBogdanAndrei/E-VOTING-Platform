# Backend NestJS + bibliotecile comune. Contextul de build e rădăcina monorepo-ului.
FROM node:22-alpine AS build
WORKDIR /repo
COPY . .
RUN npm ci -w @evoting/crypto -w @evoting/api -w @evoting/backend --include-workspace-root \
 && npm run build -w @evoting/crypto -w @evoting/api -w @evoting/backend \
 && npm prune --omit=dev -w @evoting/crypto -w @evoting/api -w @evoting/backend

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages/crypto/package.json /repo/packages/crypto/
COPY --from=build /repo/packages/crypto/dist /repo/packages/crypto/dist
COPY --from=build /repo/packages/api/package.json /repo/packages/api/
COPY --from=build /repo/packages/api/dist /repo/packages/api/dist
COPY --from=build /repo/apps/backend/package.json /repo/apps/backend/
COPY --from=build /repo/apps/backend/dist /repo/apps/backend/dist
COPY --from=build /repo/apps/backend/migrations /repo/apps/backend/migrations
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN mkdir -p /pki && chown node:node /pki
WORKDIR /repo/apps/backend
EXPOSE 3000
USER node
ENTRYPOINT ["/bin/sh", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
