FROM node:22.14.0-alpine

# Install Python and Git
RUN apk add --no-cache python3 py3-pip git

WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --production
RUN npm cache clean --force
ENV NODE_ENV="production"

# Create and activate a virtual environment, then install Python dependencies
COPY /src/scripts/requirements.txt ./
RUN python3 -m venv venv
RUN . venv/bin/activate && pip install --no-cache-dir -r requirements.txt

COPY . .
RUN npm run build
CMD ["sh", "-c", ". venv/bin/activate && npm start | node_modules/.bin/pino-pretty --ignore=req"]
