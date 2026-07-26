FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

#in here to copy it to the dist files that why i added it(dist folder)
RUN npm run build

#start the engine for the nginx
FROM nginx:alpine

#in here to copy all the dist files, that file to the engine
COPY --from=build /app/dist /usr/share/nginx/html 

EXPOSE 80
