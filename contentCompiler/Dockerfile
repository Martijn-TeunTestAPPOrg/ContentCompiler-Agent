FROM node:20-slim

# Install Python
RUN apt-get update && apt-get install -y python3 python3-pip && apt-get clean

WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --production
RUN npm cache clean --force
ENV NODE_ENV="production"
COPY . .
CMD [ "npm", "start" ]
