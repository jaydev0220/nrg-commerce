# syntax=docker/dockerfile:1

FROM node:24.18.0-alpine3.23@sha256:595398b0081eacda8e1c4c5b97b76cd1020e4d58a8ebcb4843b9bca1e79e7436 AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /workspace

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/prettier-config/package.json packages/prettier-config/package.json
COPY packages/schemas/package.json packages/schemas/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
	pnpm install --frozen-lockfile --filter @apps/api...
COPY . .
RUN pnpm --filter @packages/database db:generate
RUN pnpm --filter @apps/api build
RUN pnpm --filter @apps/api --prod deploy --legacy /prod/api

FROM scratch AS runtime

ENV NODE_ENV=production
ENV PORT=8080
ENV PATH=/usr/local/bin
ENV LIBC=musl
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

WORKDIR /app

COPY --from=base /usr/local/bin/node /usr/local/bin/node
COPY --from=base /lib/ld-musl-*.so.1 /lib/
COPY --from=base /lib/libc.musl-*.so.1 /lib/
COPY --from=base /usr/lib/libstdc++.so.6* /usr/lib/
COPY --from=base /usr/lib/libgcc_s.so.1 /usr/lib/libgcc_s.so.1
COPY --from=base /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build --chown=65532:65532 /prod/api ./

USER 65532:65532

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/node"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD ["/usr/local/bin/node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/health/liveness').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

CMD ["--enable-source-maps", "build/index.js"]
