FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including LibreOffice for Excel to PDF conversion
RUN apt-get update && apt-get install -y \
    gcc \
    libreoffice-calc \
    libreoffice-writer \
    fonts-dejavu-core \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Railway uses PORT env variable
ENV PORT=8080
EXPOSE 8080

# Run the application with PORT from environment
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT}"]
