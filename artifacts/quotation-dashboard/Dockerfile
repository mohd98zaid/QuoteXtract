FROM node:20-alpine AS builder

RUN npm install -g pnpm@9

WORKDIR /workspace

# Copy workspace config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copy lib packages (some may be referenced in the dashboard)
COPY lib/ lib/

# Copy the dashboard source
COPY artifacts/quotation-dashboard/ artifacts/quotation-dashboard/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build the frontend (production, no Replit plugins since REPL_ID is unset)
WORKDIR /workspace/artifacts/quotation-dashboard
RUN PORT=8090 BASE_PATH=/ NODE_ENV=production pnpm run build

# ── Runtime stage: serve with nginx ───────────────────────────────────────────
FROM nginx:1.27-alpine

# Copy built static files
COPY --from=builder /workspace/artifacts/quotation-dashboard/dist/public /usr/share/nginx/html

# Copy nginx configuration
COPY artifacts/quotation-dashboard/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
