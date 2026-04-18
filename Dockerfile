# ==========================================
# Stage 1: Build the Next.js Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files and install dependencies
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# Copy the rest of the frontend source code
COPY frontend/ ./

# Build the Next.js application (generates static files in /app/frontend/out)
RUN npm run build


# ==========================================
# Stage 2: Setup FastAPI Backend and Production Image
# ==========================================
FROM python:3.11-slim

WORKDIR /app

# System dependencies for scientific packages if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the backend source code
COPY backend/ ./backend/

# Copy the statically built frontend from the previous stage
COPY --from=frontend-builder /app/frontend/out ./frontend/out

# Switch to the backend directory for the final execution
WORKDIR /app/backend

# Expose the standard Hugging Face Spaces port
EXPOSE 7860

# Run Uvicorn server using port 7860
# --workers 4 unlocks parallel processing on multi-core environments!
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "4"]
