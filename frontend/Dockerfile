FROM node:20-alpine

WORKDIR /app

COPY package.json .
RUN npm install \
    && chown -R node:node /app

COPY --chown=node:node . .

USER node

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]