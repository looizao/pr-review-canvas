FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git gh ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@10.33.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY src ./src
COPY static ./static
COPY prompts ./prompts
COPY bin ./bin
COPY skills ./skills
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "--import", "tsx", "src/hosted/main.ts"]
