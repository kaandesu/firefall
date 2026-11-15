# FIREFALL web app: the built page plus a small node server (web/server/prod.ts) that serves it and forwards
# /api/lagrange to a Lagrange server, so the deployed app can Connect. Without Lagrange it is the scripted demo.
# Build context is the repo root (web/ imports ../data/psi). Port 80.
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@8.10.4 --activate
WORKDIR /app
COPY data/psi/investigations.json data/psi/investigations.json
COPY web/package.json web/pnpm-lock.yaml web/
RUN cd web && pnpm install --frozen-lockfile
COPY web/ web/
RUN cd web && pnpm build

FROM node:22-alpine
WORKDIR /app
COPY web/server/prod.ts web/server/lagrange-proxy.ts server/
COPY --from=build /app/web/dist dist
ENV NODE_ENV=production PORT=80
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
CMD ["node", "server/prod.ts"]
