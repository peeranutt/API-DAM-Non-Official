FROM node:20-bullseye

# ติดตั้ง OS dependencies
RUN apt-get update && apt-get install -y \
    libreoffice \
    poppler-utils \
    ffmpeg \
    fonts-noto \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# ตั้ง working directory
WORKDIR /app

# copy package.json ก่อน (เพื่อ cache)
COPY package*.json ./

RUN npm install

# copy source code
COPY . .

# build nest
RUN npm run build

# expose port
EXPOSE 3001

# start
CMD ["node", "dist/main.js"]
