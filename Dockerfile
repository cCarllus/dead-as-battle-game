ARG NODE_VERSION=24.11.0
FROM node:${NODE_VERSION}-alpine

ARG NPM_VERSION=11.6.1

WORKDIR /app

RUN npm install -g npm@${NPM_VERSION}

COPY package.json package-lock.json ./
RUN npm ci

EXPOSE 5173 2567

CMD ["npm", "run", "dev:all"]
