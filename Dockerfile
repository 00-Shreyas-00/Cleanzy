FROM node:24-alpine

WORKDIR /app

# Install system utilities needed for build if any (like openssl for prisma)
RUN apk add --no-cache openssl

COPY package*.json ./

RUN npm install

COPY . .

# Generate Prisma Client
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
