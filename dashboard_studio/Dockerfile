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
ARG BUILD_ARCH

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-aiohttp python3-yaml python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Real 3D Teslas (x86 only): tesla-model-extractor, and GDRE Tools, which reads the Godot project inside the
# Tesla app. GDRE is a headless Godot build that still links X11, GL, sound and fonts.
ARG TME_REF=e05552b59bd30689051b30b309eb52c1bde6f7f3
ARG GDRE_VERSION=2.6.4
ARG GDRE_SHA256=eda8cb09e64a060728fa371aa80ae148d3c5584a7de2f553699936daa84e7b4e
RUN if [ "${BUILD_ARCH}" = "amd64" ]; then \
      apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip git \
        libx11-6 libxcursor1 libxinerama1 libxrandr2 libxi6 libxext6 libxrender1 \
        libgl1 libglu1-mesa libasound2 libpulse0 libfontconfig1 libfreetype6 libdbus-1-3 libudev1 \
      && mkdir -p /opt/gdre && cd /opt/gdre \
      && curl -fsSL -o gdre.zip "https://github.com/GDRETools/gdsdecomp/releases/download/v${GDRE_VERSION}/GDRE_tools-v${GDRE_VERSION}-linux.zip" \
      && echo "${GDRE_SHA256}  gdre.zip" | sha256sum -c - && unzip -q gdre.zip && rm gdre.zip && chmod +x gdre_tools.x86_64 \
      && python3 -m venv /opt/tme \
      && /opt/tme/bin/pip install --no-cache-dir "tesla-model-extractor @ git+https://github.com/koenhendriks/tesla-model-extractor@${TME_REF}" \
      && apt-get purge -y git && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*; \
    fi
ENV GDRE_TOOLS=/opt/gdre/gdre_tools.x86_64

ENV PYTHONUNBUFFERED=1 STUDIO_VERSION=1.1.2
COPY rootfs /

RUN chmod a+x /run.sh

CMD ["/run.sh"]
