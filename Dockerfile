# Use the official Node.js 16 as a parent image
FROM node:16

# Set the working directory in the container
WORKDIR /usr/src/app

# Install necessary dependencies for Puppeteer
# (Include the dependency installation commands here as before)

# Create a new user "appuser" and switch to it
RUN groupadd -r appuser && useradd -r -g appuser -G audio,video appuser \
    && mkdir -p /home/appuser/Downloads \
    && chown -R appuser:appuser /home/appuser \
    && chown -R appuser:appuser /usr/src/app

# Copy package.json and package-lock.json (if available) to the container
COPY package*.json ./

# Install any dependencies
RUN npm install

# Bundle the source code inside the Docker image
COPY . .

# Change ownership of the working directory to the new user
RUN chown -R appuser:appuser /usr/src/app

# Switch to the non-root user
USER appuser

# Make port 5000 available to the world outside this container
EXPOSE 5000

# Run the application when the container launches
CMD ["node", "app.js"]
