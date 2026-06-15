FROM node:18-alpine

WORKDIR /app

# Install dependencies first (caching)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

EXPOSE 5173

# Vite dev server - host 0.0.0.0 so it's accessible outside the container
CMD ["npx", "vite", "--host", "0.0.0.0"]
