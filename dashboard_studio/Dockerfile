ARG BUILD_FROM
FROM ${BUILD_FROM}

RUN apk add --no-cache python3 py3-aiohttp py3-yaml

ENV PYTHONUNBUFFERED=1 STUDIO_VERSION=0.1.0
COPY rootfs /

CMD ["python3", "/app/server.py"]
