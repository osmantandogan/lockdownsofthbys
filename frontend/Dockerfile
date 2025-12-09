FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install ALL dependencies (dev included for build)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Set build-time environment variables
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
# OneSignal App ID (public identifier - not a secret)
ENV REACT_APP_ONESIGNAL_APP_ID=207f0010-c2d6-4903-9e9d-1e72dfbc3ae2
ENV DISABLE_HOT_RELOAD=true
ENV GENERATE_SOURCEMAP=false

# Build the app
RUN npm run build

# Install serve globally
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Serve the app
CMD ["sh", "-c", "serve -s build -l $PORT"]
