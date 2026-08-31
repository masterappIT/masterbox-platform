FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma.config.ts ./
COPY prisma ./prisma
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
COPY graphQL ./graphQL
COPY controller ./controller
COPY route ./route
COPY middleware ./middleware
COPY lib ./lib
COPY api ./api
COPY utils ./utils
COPY config ./config
COPY scripts ./scripts
COPY app.js ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "npx prisma migrate deploy && node app.js"]
