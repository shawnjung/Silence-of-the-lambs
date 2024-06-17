FROM node:4 AS node
FROM heroku/heroku:18
COPY --from=node /usr/lib /usr/lib
COPY --from=node /usr/local/share /usr/local/share
COPY --from=node /usr/local/lib /usr/local/lib
COPY --from=node /usr/local/include /usr/local/include
COPY --from=node /usr/local/bin /usr/local/bin
EXPOSE 8080
RUN gem install foreman
RUN npm install -g coffeescript@1
COPY . /app
WORKDIR /app
ENV PORT=8080
RUN npm install
CMD foreman start
