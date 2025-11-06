# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
COPY client/package.json client/
COPY server/package.json server/

RUN npm install --include-workspace-root || npm install --ignore-scripts --include-workspace-root

COPY client client
COPY server server
COPY README.md LICENSE ./

RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=base /app /app
ENV NODE_ENV=production
EXPOSE 4000
EXPOSE 3000
CMD ["npm", "run", "dev"]
