FROM node:22-alpine AS build
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package*.json yarn.lock ./
ENV NODE_ENV=production
RUN yarn install --frozen-lockfile --production=false
COPY . .
ENV VITE_BACKEND_URL=VITE_BACKEND_URL_RUNTIME_REPLACEMENT
RUN yarn build

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY scripts/replace_backend_url.sh /
RUN chmod +x /replace_backend_url.sh
COPY --from=build /usr/src/app/dist/build/h5 /usr/share/nginx/html

CMD ["sh", "/replace_backend_url.sh"]
