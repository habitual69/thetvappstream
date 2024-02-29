# Use the official Node.js 16 as a parent image
FROM node:16

# Set the working directory in the container
WORKDIR /usr/src/app

# Install necessary dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libgbm1 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json (if available) to the container
COPY package*.json ./

# Install any dependencies
RUN npm install

# If you're building your code for production
# RUN npm ci --only=production

# Bundle the source code inside the Docker image
COPY . .

# Make port 5000 available to the world outside this container
EXPOSE 5000

# Define environment variables (if needed)
# ENV TV_URL=https://thetvapp.to

# Run the application when the container launches
CMD ["node", "app.js"]
