-include .env
export $(shell sed 's/=.*//' .env)

nodejsContainerName=popsicle-nodejs

.PHONY: help

## Displays available commands
help:
	@echo "$$(tput bold)Available rules:$$(tput sgr0)";echo;sed -ne"/^## /{h;s/.*//;:d" -e"H;n;s/^## //;td" -e"s/:.*//;G;s/\\n## /---/;s/\\n/ /g;p;}" ${MAKEFILE_LIST}|LC_ALL='C' sort -f|awk -F --- -v n=$$(tput cols) -v i=19 -v a="$$(tput setaf 6)" -v z="$$(tput sgr0)" '{printf"%s%*s%s ",a,-i,$$1,z;m=split($$2,w," ");l=n-i;for(j=1;j<=m;j++){l-=length(w[j])+1;if(l<= 0){l=n-i-length(w[j])-1;printf"\n%*s ",-i," ";}printf"%s ",w[j];}printf"\n";}'|more $(shell test $(shell uname) == Darwin && echo '-Xr')
## Alias for "docker-compose up"
up:
	docker-compose up
## Alias for "docker-compose down"
down:
	docker-compose down
## Application initialization
init: network-create deps-install
## Creates docker network if not exists
network-create:
	docker network create popsicle || true
deps-install:
	docker-compose run ${nodejsContainerName} sh -c "yarn"
## Execute shell in the already running nodejs container
exec-nodejs-container:
	docker-compose exec ${nodejsContainerName} sh
## Run new nodejs container and execute shell
run-nodejs-container:
	docker-compose run ${nodejsContainerName} sh
## Run linter
lint:
	npx eslint src/ --ext .ts,.js
## Fix linter errors
lint-fix:
	npx eslint src/ --ext .ts,.js --fix
## Make production build
prod-build:
	npm i
	npx tsc -p tsconfig.build.json --sourceMap false --declaration false
	cp -r node_modules dist/node_modules
## For testing production build on local machine
prod-up:
	node dist/src/main.js
test: 
	npm run test
test-watch:
	npm run test:watch
local:
	npm run start:dev