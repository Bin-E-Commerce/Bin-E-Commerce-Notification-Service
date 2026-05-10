FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY tsconfig.base.json ./
COPY services/notification-service/package.json ./services/notification-service/
COPY services/notification-service/tsconfig.json ./services/notification-service/
COPY services/notification-service/src ./services/notification-service/src
COPY packages/common ./packages/common
RUN npm install --workspace=services/notification-service
WORKDIR /app/services/notification-service
RUN npx nest build

FROM node:20-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
WORKDIR /app
COPY --from=builder /app/services/notification-service/package.json ./
COPY --from=builder /app/packages/common ./packages/common
RUN npm install --omit=dev
COPY --from=builder /app/services/notification-service/dist ./dist
USER nestjs
EXPOSE 3006
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3006/api/health || exit 1
CMD ["node","--max-old-space-size=100","dist/main"]
