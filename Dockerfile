# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# package.json과 package-lock.json 복사 (캐싱 최적화)
COPY package*.json ./

# 모든 의존성 설치 (빌드에 필요한 devDependencies 포함)
RUN npm ci

# 소스 코드 복사
COPY src ./src
COPY tsconfig.json ./
COPY nest-cli.json ./

# NestJS 빌드 실행
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app

# package.json 복사
COPY package*.json ./

# production 의존성만 설치
RUN npm ci --only=production

# 빌드된 dist 폴더 복사
COPY --from=build /app/dist ./dist

EXPOSE 3000

# 프로덕션 모드로 실행
ENV NODE_ENV=production
CMD ["node", "dist/main"]
