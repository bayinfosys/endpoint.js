from python:3-slim

copy requirements.txt /tmp/requirements.txt

run pip install -q --no-cache-dir -r /tmp/requirements.txt

workdir /app

copy . /app

expose 8000

env PYTHONPYCACHEPREFIX=/tmp

cmd uvicorn main:app --host 0.0.0.0 --port 8000
