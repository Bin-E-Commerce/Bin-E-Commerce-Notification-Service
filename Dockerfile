# Notification Service dùng build context là root repository để resolve lockfile
# và tsconfig.base.json của monorepo. HTTP API và Kafka consumer chạy cùng process;
# Lambda/worker khác không thuộc image này.

# -----------------------------------------------------------------------------
# Giai đoạn build: cài dependency và compile source Notification.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifest trước source để Docker cache layer npm khi chỉ thay đổi code.
COPY package.json package-lock.json tsconfig.base.json ./
COPY services/notification-service/package.json services/notification-service/tsconfig.json ./services/notification-service/
COPY packages/common ./packages/common

# Dùng lockfile root và chỉ cài workspace Notification cùng dev dependency cần build.
ENV NODE_ENV=development
RUN npm ci --workspace=services/notification-service --include=dev --bin-links=true --ignore-scripts \
  && test -x node_modules/.bin/tsc

# Consumer và HTTP controller đều nằm trong src; assets email được giữ riêng để
# runtime có thể nhúng logo vào template mà không cần đọc source TypeScript.
COPY services/notification-service/src ./services/notification-service/src
COPY services/notification-service/assets ./services/notification-service/assets

# tsconfig.json dùng rootDir monorepo, output nằm dưới dist/services/notification-service/src.
RUN npx tsc -p services/notification-service/tsconfig.json

# Loại Nest CLI, TypeScript, Jest và các dev dependency trước runtime stage.
RUN npm prune --omit=dev

# TypeScript giữ nguyên alias @common/* trong JavaScript sau khi compile.
# Đặt bản build của package chung vào node_modules để Node.js resolve được alias
# mà không cần thêm loader runtime hoặc cài thêm dependency vào ứng dụng.
RUN mkdir -p node_modules/@common \
  && cp -R services/notification-service/dist/packages/common/. node_modules/@common/

# npm có thể đặt dependency production riêng của workspace dưới thư mục nested
# khi phiên bản dependency không thể hoist lên root; gom chúng vào root để Node
# resolve được dependency từ dist/services/notification-service lúc runtime.
RUN cp -R services/notification-service/node_modules/. node_modules/

# -----------------------------------------------------------------------------
# Giai đoạn runtime: image non-root, chỉ giữ artifact HTTP/consumer và assets email.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Update Alpine packages so the runtime receives current security fixes.
RUN apk upgrade --no-cache

# npm/npx chỉ cần ở builder để cài dependency; runtime chỉ chạy bằng node.
# Loại chúng khỏi final image để không mang theo dependency/tooling không cần thiết của npm.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
  && addgroup -g 1001 -S nodejs \
  && adduser -S nestjs -u 1001

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
# Giữ toàn bộ dist của workspace vì TypeScript compile cả packages/common để
# phục vụ alias @common/* lúc runtime. Dist này chỉ chứa Notification và common,
# không chứa source hoặc artifact của các service khác.
COPY --from=builder --chown=nestjs:nodejs /app/services/notification-service/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/services/notification-service/assets ./assets

# Port thật của Notification Service là 3005; Compose/Kubernetes có thể override.
ENV NODE_ENV=production \
  PORT=3005 \
  NODE_OPTIONS=--max-old-space-size=128

EXPOSE 3005

# Health dùng route versioned thật và chỉ xác nhận HTTP process còn sống.
# Mongo/Kafka/SMTP được báo trong response health nhưng không làm container restart
# liên tục khi dependency tạm thời chưa sẵn sàng.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider "http://localhost:${PORT}/api/v1/health" || exit 1

USER nestjs

# Chạy Node trực tiếp để nhận SIGTERM đúng khi consumer được dừng hoặc rollout.
CMD ["node", "dist/services/notification-service/src/main.js"]
