FROM node:24-alpine AS builder

WORKDIR /app

# Copy root and package manifests
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install dependencies across workspaces
RUN npm install

# Copy source code
COPY . .

# Build backend and frontend
RUN npm run build

# Seed database
RUN npm run seed

EXPOSE 5000 3000

CMD ["npm", "run", "dev"]
