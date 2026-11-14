# FIREFALL demo: the static web app (scripted replay, shipped FDS run, demo-mode report chat). No backend.
# Build context is the repo root (web/ imports ../data/psi). Coolify: Build Pack = Dockerfile, port 80.
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@8.10.4 --activate
WORKDIR /app
COPY data/psi/investigations.json data/psi/investigations.json
COPY web/package.json web/pnpm-lock.yaml web/
RUN cd web && pnpm install --frozen-lockfile
COPY web/ web/
RUN cd web && pnpm build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
