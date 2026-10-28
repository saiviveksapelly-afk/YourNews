FROM node:24-bookworm

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=0

COPY package*.json ./
RUN npm ci --include=dev

RUN npx playwright install --with-deps chromium

COPY . .
RUN npm run build

CMD ["npm", "start"]