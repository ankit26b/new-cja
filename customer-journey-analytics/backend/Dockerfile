FROM node:18-alpine

WORKDIR /app

# Install dependencies first (caching)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
