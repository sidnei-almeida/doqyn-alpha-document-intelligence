#!/bin/sh
# Recarrega o nginx periodicamente para captar o certificado renovado pelo
# certbot. Sem isso o certificado novo fica em disco e o navegador continua
# vendo o antigo até expirar.
#
# Mora em /docker-entrypoint.d/ e não no CMD da imagem de propósito: o
# entrypoint do nginx só executa esses scripts (e o envsubst dos templates)
# quando o primeiro argumento é `nginx`. Trocar o CMD por `sh -c ...` faz o
# entrypoint pular o rendering inteiro e subir com a conf de fábrica.
#
# O loop dorme antes do primeiro reload, então não corre o risco de chamar
# `nginx -s reload` antes do master existir.
( while :; do sleep 6h; nginx -s reload 2>/dev/null || true; done ) &
