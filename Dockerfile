# -------------------------------------------------------------
# Stage 1: Base & Dependencies
# -------------------------------------------------------------
FROM node:22-alpine AS base

WORKDIR /app
RUN apk add --no-cache openssl

COPY package*.json ./

# -------------------------------------------------------------
# Stage 2: Development (Hot-reloading with nodemon)
# -------------------------------------------------------------
FROM base AS development

ENV NODE_ENV=development
RUN npm install

COPY tsconfig.json ./
COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

EXPOSE 4200
CMD ["npm", "run", "dev"]

# -------------------------------------------------------------
# Stage 3: Builder (TypeScript Compilation)
# -------------------------------------------------------------
FROM base AS builder

RUN npm install

COPY tsconfig.json ./
COPY prisma ./prisma/
RUN npx prisma generate

COPY src ./src/
RUN npm run build

# -------------------------------------------------------------
# Stage 4: Production Runner (Lean, Secure, Non-root)
# -------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

# Run as non-root user
USER node

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --chown=node:node --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node public ./public
COPY --chown=node:node pages ./pages

EXPOSE 4200

CMD ["node", "dist/index.js"]
