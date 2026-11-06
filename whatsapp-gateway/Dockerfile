# whatsapp-web.js drives a real WhatsApp Web page in Chromium, so this image is Debian with Chromium rather than Alpine.
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-noto-cjk ca-certificates dumb-init \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=4100 \
    DATA_PATH=/data/wwebjs

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src

# Each channel's WhatsApp login lives here; without a volume every number has to scan again after a deploy.
RUN mkdir -p /data/wwebjs && chown -R node:node /data /app
VOLUME /data/wwebjs
USER node

EXPOSE 4100
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
