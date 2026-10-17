# Build the static site, then serve it with nginx. The entrypoint writes config.json from
# RDM_* environment variables so one image works for every endpoint.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/react/package.json packages/react/
COPY packages/app/package.json packages/app/
COPY packages/shapes-dim/package.json packages/shapes-dim/
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build -w packages/app

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=build /app/packages/app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /docker-entrypoint.d/40-rdm-config.sh
EXPOSE 8080
