FROM node:20-bullseye

# 1️⃣ ติดตั้ง dependency สำหรับ document processing
RUN apt-get update && apt-get install -y \
    libreoffice \
    poppler-utils \
    ffmpeg \
    fonts-dejavu \
    fonts-thai-tlwg \
    && rm -rf /var/lib/apt/lists/*

# 2️⃣ ตั้ง working directory
WORKDIR /app

# 3️⃣ copy package.json ก่อน (เพื่อ cache)
COPY package*.json ./
RUN npm install
RUN npm install --os=linux --cpu=x64 sharp

# 4️⃣ copy source
COPY . .

# 5️⃣ build NestJS
RUN npm run build

# 6️⃣ expose port
EXPOSE 3001

# 7️⃣ start app
CMD ["node", "dist/src/main.js"]