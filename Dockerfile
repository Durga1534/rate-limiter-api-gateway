# ---- Base image ----
FROM node:22-alpine

# ---- Set working directory ----
WORKDIR /app

# ---- Install dependencies first (better caching) ----
COPY package*.json ./

RUN npm install

# ---- Copy source code ----
COPY . .

# ---- Generate Prisma client ----
RUN npx prisma generate

# ---- Build TypeScript ----
RUN npm run build

# ---- Expose API port ----
EXPOSE 5050

# ---- Start server ----
CMD ["node", "server.ts"]
