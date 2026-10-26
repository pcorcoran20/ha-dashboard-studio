# ╭──────────────────────────────────────────────────────╮
# │                                                      │
# │          ,,                                          │
# │        <(o )___           ✦ PATRICK'S NEST ✦         │
# │         ( ._> /           quackomation for HA        │
# │          `---'            hatched with love          │
# │      __       __       __                            │
# │    <(o )__  <(o )__  <(o )__    (the interns)        │
# │     (._>/    (._>/    (._>/     unpaid. underfoot.   │
# │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  │
# │                                                      │
# │   file     : Dockerfile                              │
# │   author   : Patrick (and the interns)               │
# │   hatched  : 2026-10-26                              │
# │   license  : Muscovy Public License (joke, see       │
# │              LICENSE file for the real one)          │
# │   status   : no ducks harmed. all fed. one is        │
# │              sitting on the keyboard.                │
# │                                                      │
# ╰──────────────────────────────────────────────────────╯

ARG BUILD_FROM
FROM ${BUILD_FROM}

RUN apk add --no-cache python3 py3-aiohttp py3-yaml

ENV PYTHONUNBUFFERED=1 STUDIO_VERSION=0.2.0
COPY rootfs /

CMD ["python3", "/app/server.py"]
