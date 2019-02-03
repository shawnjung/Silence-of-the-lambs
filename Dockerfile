FROM heroku/heroku:18
EXPOSE 8080
RUN apt update 
RUN apt install nodejs npm -y
RUN gem install foreman
RUN npm install -g coffeescript@1
COPY . /app
WORKDIR /app
ENV PORT=8080
RUN npm install
CMD foreman start