FROM node:18

WORKDIR /app

COPY . .

RUN yarn install --frozen-lockfile

RUN yarn run build

EXPOSE 3000

VOLUME /var/run/docker.sock

CMD ["yarn", "start:prod"]