# ProjectLens ML service (FastAPI + sentence-transformers), CPU only.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

# CPU wheels keep the image far smaller than the default CUDA build of torch.
COPY requirements.txt .
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch \
 && pip install -r requirements.txt

COPY *.py ./
RUN mkdir -p artifacts && useradd --create-home app && chown -R app /app
USER app

# The model is downloaded from Google Drive on first start; keep it on a volume.
VOLUME ["/app/artifacts"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=600s \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health').status==200 else 1)"
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
