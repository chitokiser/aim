FROM python:3.11-slim
WORKDIR /app
COPY bots/whalesignal-x/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY bots/whalesignal-x/ .
CMD ["python", "bot.py"]
