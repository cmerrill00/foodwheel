FROM python:3.12-slim

WORKDIR /app

# Install dependencies first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .
COPY default_config.json .
COPY templates/ templates/
COPY static/ static/

# Data lives outside the app directory so a volume mount doesn't shadow any app files
RUN mkdir -p /data

ENV DATA_DIR=/data
ENV PORT=5000

EXPOSE 5000

# Single worker + threads keeps the threading.Lock() effective across requests
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "4", "--timeout", "120", "app:app"]
