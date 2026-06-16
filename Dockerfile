FROM nginx:alpine
COPY rhesus-ui/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
