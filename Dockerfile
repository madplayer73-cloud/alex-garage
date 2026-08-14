FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV ALEX_AUTO_HOST=0.0.0.0
ENV ALEX_AUTO_PORT=3000
ENV ALEX_AUTO_DATA_DIR=/data
COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts
EXPOSE 3000
VOLUME ["/data"]
CMD ["npm", "start"]
