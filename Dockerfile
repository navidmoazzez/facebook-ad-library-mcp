# The browser backend needs Chromium, so this starts from Playwright's image
# rather than a bare node image. That is most of the size, and the alternative
# is an image where the default backend does not work.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY dist ./dist
COPY README.md SKILL.md LICENSE ./

ENV NODE_ENV=production
ENV FBADS_HTTP_HOST=0.0.0.0
EXPOSE 8787

# Loopback is the default outside Docker. Inside a container the port is already
# scoped by the runtime, so binding the interface is correct here.
ENTRYPOINT ["node", "dist/index.js"]
CMD ["--http"]
