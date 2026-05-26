# ==========================================
# SKILLQUEST AI ENGINE - DOCKERFILE
# ==========================================

FROM python:3.10-slim

# Set environment variables to optimize Python performance inside Docker
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# 1. Install system dependencies if required (e.g. gcc for scikit-learn/numpy compilation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 2. Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copy application source files
COPY . .

# 4. Expose the default FastAPI port (8001)
EXPOSE 8001

# 5. Run the FastAPI application using Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
