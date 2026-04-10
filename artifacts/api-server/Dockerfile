FROM node:20-alpine AS builder

# Install build dependencies and pdftotext
RUN apk add --no-cache \
    poppler-utils \
    python3 \
    make \
    g++ \
    libc6-compat

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /workspace

# Copy workspace config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copy all lib packages (bundled by esbuild, need source at build time)
COPY lib/ lib/

# Copy API server source
COPY artifacts/api-server/ artifacts/api-server/

# Install all workspace dependencies
RUN pnpm install --no-frozen-lockfile

# Build the API server (esbuild bundles everything into dist/)
WORKDIR /workspace/artifacts/api-server
RUN pnpm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine

# Install pdftotext for PDF text extraction
RUN apk add --no-cache poppler-utils

# Install pnpm (needed to install runtime node_modules)
RUN npm install -g pnpm@9

WORKDIR /workspace/artifacts/api-server

# Copy built bundle
COPY --from=builder /workspace/artifacts/api-server/dist ./dist

# Copy package.json and install ONLY production/runtime dependencies
# (externalized packages like nodemailer, imapflow, mailparser, sharp)
COPY --from=builder /workspace/artifacts/api-server/package.json ./package.json
COPY --from=builder /workspace/pnpm-workspace.yaml /workspace/pnpm-workspace.yaml
COPY --from=builder /workspace/package.json /workspace/package.json
COPY --from=builder /workspace/pnpm-lock.yaml /workspace/pnpm-lock.yaml
COPY --from=builder /workspace/lib /workspace/lib

WORKDIR /workspace
RUN pnpm install --no-frozen-lockfile --prod

WORKDIR /workspace/artifacts/api-server

# Create PDF storage directory
RUN mkdir -p /tmp/quotation-pdfs

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
