# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e
ARG PHP_IMAGE=php:8.4-fpm-bookworm@sha256:587f5baa2cfe29e6473c0b804a501d989df1913a3f7b8f9ffefe30da551acbca
ARG COMPOSER_IMAGE=composer:2@sha256:af98f42dfff7c68ba8d53c2164fd9fde1087b7d449514baa38c418b1f6bc4bac

FROM ${COMPOSER_IMAGE} AS composer

FROM ${PHP_IMAGE} AS extensions
RUN apt-get update \
    && apt-get install -y --no-install-recommends libjpeg62-turbo-dev libpng-dev libpq-dev libwebp-dev libzip-dev unzip \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install -j"$(nproc)" exif gd opcache pcntl pdo_pgsql zip \
    && pecl install redis-6.2.0 \
    && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/*

FROM extensions AS application
COPY --from=composer /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/html
ENV COMPOSER_ALLOW_SUPERUSER=1
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-progress --no-scripts --no-autoloader
COPY . .
RUN mkdir -p bootstrap/cache \
    && composer dump-autoload --no-dev --optimize --no-interaction \
    && composer check-platform-reqs --no-dev

FROM application AS development

FROM ${PHP_IMAGE} AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl libjpeg62-turbo libpng16-16 libpq5 libwebp7 libzip4 nginx-light \
    && rm -rf /var/lib/apt/lists/*
COPY --from=extensions /usr/local/lib/php/extensions/ /usr/local/lib/php/extensions/
COPY --from=extensions /usr/local/etc/php/conf.d/ /usr/local/etc/php/conf.d/
COPY --from=application /var/www/html /var/www/html
WORKDIR /var/www/html
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && install -d -o www-data -g www-data storage/app/public storage/app/private \
        storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs storage/logs/pagos \
    && chown www-data:www-data bootstrap/cache

COPY <<'INI' /usr/local/etc/php/conf.d/camba.ini
expose_php=Off
upload_max_filesize=10M
post_max_size=125M
memory_limit=256M
opcache.enable=1
INI

COPY <<'FPM' /usr/local/etc/php-fpm.d/zz-camba.conf
[www]
access.format = "%m %s %d"
FPM

COPY <<'NGINX' /etc/nginx/camba.conf
worker_processes auto;
pid /tmp/camba-nginx.pid;
error_log /dev/stderr warn;
events { worker_connections 1024; }
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    access_log off;
    server_tokens off;
    client_max_body_size 125m;
    client_body_temp_path /tmp/camba-client;
    proxy_temp_path /tmp/camba-proxy;
    fastcgi_temp_path /tmp/camba-fastcgi;
    uwsgi_temp_path /tmp/camba-uwsgi;
    scgi_temp_path /tmp/camba-scgi;
    resolver 127.0.0.11 valid=10s ipv6=off;
    map $http_x_forwarded_proto $camba_https {
        default off;
        https on;
    }
    server {
        listen 8080;
        root /var/www/html/public;
        index index.php;
        include fastcgi_params;
        fastcgi_param HTTPS $camba_https;
        fastcgi_param SCRIPT_FILENAME /var/www/html/public/index.php;
        fastcgi_param HTTP_PROXY "";
        set $fpm api-fpm:9000;
        location = /robots.txt { }
        location = /ready {
            fastcgi_connect_timeout 2s;
            fastcgi_read_timeout 3s;
            error_page 502 504 =503 @not_ready;
            fastcgi_pass $fpm;
        }
        location @not_ready {
            default_type application/json;
            add_header Cache-Control no-store always;
            return 503 '{"status":"not_ready"}';
        }
        location ~ ^/storage/(?<asset>[a-zA-Z0-9/_-]+\.(?:jpe?g|png|webp))$ {
            alias /var/www/html/storage/app/public/$asset;
            disable_symlinks on;
            add_header X-Content-Type-Options nosniff always;
        }
        location /storage/ { return 404; }
        location / {
            fastcgi_pass $fpm;
        }
    }
}
NGINX

USER www-data
EXPOSE 8080
CMD ["php-fpm"]
