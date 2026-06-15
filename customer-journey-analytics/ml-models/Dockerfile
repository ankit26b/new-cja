FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Generate dummy model if not present (will be overwritten by train_model.py)
RUN python create_dummy_model.py

EXPOSE 8000

CMD ["python", "run.py"]
