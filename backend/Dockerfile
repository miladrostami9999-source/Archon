FROM python:3.11-slim

WORKDIR /app

# نصب dependencies سیستم
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# نصب packages پایتون
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# کپی کد
COPY . .

# اجرای سرور
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
