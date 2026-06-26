# REQ2UI backend — Node service that compiles the SRS to PDF with Tectonic.
FROM node:20-slim

# Runtime libs: ca-certificates for Tectonic's HTTPS bundle fetch; fontconfig +
# a base font so resvg (Mermaid SVG → PNG) renders diagram labels sensibly.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl fontconfig fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Pinned, self-contained (musl) Tectonic binary — a single static TeX engine that
# fetches and caches the packages our preamble needs on first compile.
ARG TECTONIC_VERSION=0.16.9
RUN curl -fsSL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
      | tar -xz -C /usr/local/bin tectonic \
    && tectonic --version

WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Pre-fetch every package the SRS preamble pulls in, so the first real export
# doesn't pay the one-time download. Cache lands in /root/.cache/Tectonic.
RUN printf '%s' '\documentclass[11pt,a4paper]{report}\usepackage[utf8]{inputenc}\usepackage[T1]{fontenc}\usepackage{lmodern}\usepackage[a4paper,margin=1in]{geometry}\usepackage[table]{xcolor}\usepackage{booktabs}\usepackage{array}\usepackage{tabularx}\usepackage{xltabular}\usepackage{ragged2e}\usepackage{enumitem}\usepackage{caption}\usepackage{graphicx}\usepackage{float}\usepackage{titlesec}\usepackage{fancyhdr}\usepackage{hyperref}\begin{document}warm\end{document}' > /tmp/warm.tex \
    && tectonic /tmp/warm.tex --outdir /tmp \
    && rm -f /tmp/warm.*

ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "start"]
