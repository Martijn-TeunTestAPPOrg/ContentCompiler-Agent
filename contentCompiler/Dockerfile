FROM node:22.14.0-alpine

# Install dependencies
RUN apk add --no-cache python3 py3-pip git openssh-client

WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --production
RUN npm cache clean --force
ENV NODE_ENV="production"

# Copy SSH key and known_hosts
COPY .ssh/id_rsa_github_bot /root/.ssh/id_rsa
COPY .ssh/id_rsa_github_bot.pub /root/.ssh/id_rsa.pub

# Fix SSH key permissions
RUN chmod 600 /root/.ssh/id_rsa && chmod 644 /root/.ssh/id_rsa.pub

# Add GitHub to known hosts
RUN ssh-keyscan github.com >> /root/.ssh/known_hosts

# Install Python dependencies
COPY /src/scripts/requirements.txt ./
RUN python3 -m venv venv
RUN . venv/bin/activate && pip install --no-cache-dir -r requirements.txt

# Copy the rest of the app
COPY . .
RUN npm run build

# Create logs directory
RUN mkdir -p /app/logs

# Start the app
CMD ["sh", "-c", ". venv/bin/activate && npm start | node_modules/.bin/pino-pretty --ignore=req"]
