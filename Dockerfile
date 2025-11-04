# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# package.json과 package-lock.json 복사 (캐싱 최적화)
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production

# 소스 코드만 복사 (필요한 파일만 명시)
COPY bot.js ./
COPY server.js ./

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app

# 빌드된 node_modules와 소스 코드 복사
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/bot.js ./
COPY --from=build /app/server.js ./

EXPOSE 3000

# 프로덕션 모드로 실행
ENV NODE_ENV=production
ENTRYPOINT ["node", "server.js"]