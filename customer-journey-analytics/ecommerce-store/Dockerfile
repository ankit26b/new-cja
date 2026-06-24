FROM node:18-alpine

WORKDIR /app

# Install dependencies first (caching)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

EXPOSE 3000

# Vite dev server accessible outside container
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "3000"]
