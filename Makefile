SHELL=/bin/bash

# load environment variabels
include .env
export

################################################################################
## VARIABLES
################################################################################

NPM ?= npm --prefix ./functions
NPMRUN ?= $(NPM) run
NPMLIST ?= $(NPM) list
NPMTEST ?= $(NPM) test

FIREBASE ?= firebase
FIREBASEUSE ?= $(FIREBASE) use
FIREBASESET ?= $(FIREBASE) functions:config:set
FIREBASEGET ?= $(FIREBASE) functions:config:get
FIREBASEDEPLOY ?= $(FIREBASE) deploy


################################################################################
## ENVIRONMENT CHECKS
################################################################################
.PHONY: check-deploy-env check-emulator-env check-test-env

check-deploy-env:
ifndef FUNCTIONS_PREDEPLOY
	$(error FUNCTIONS_PREDEPLOY is undefined)
endif
ifndef GOOGLE_MAPS_API_KEY
	$(error GOOGLE_MAPS_API_KEY is undefined)
endif

check-emulator-env:
ifndef GOOGLE_MAPS_API_KEY
	$(error GOOGLE_MAPS_API_KEY is undefined)
endif
ifndef EMULATORS_FUNCTIONS_PORT
	$(error EMULATORS_FUNCTIONS_PORT is undefined)
endif
ifndef EMULATORS_FUNCTIONS_HOST
	$(error EMULATORS_FUNCTIONS_HOST is undefined)
endif
ifndef EMULATORS_UI_ENABLED
	$(error EMULATORS_UI_ENABLED is undefined)
endif

check-test-env:
ifndef GOOGLE_MAPS_API_KEY
	$(error GOOGLE_MAPS_API_KEY is undefined)
endif


################################################################################
## FIREBASE CONFIGS
################################################################################
.PHONY: use-dev-project use-stag-project use-prod-project deploy-config emulator-config test-config

use-dev-project:
# use development project
	@$(FIREBASEUSE) venni-rider-development-8a3f8

use-stag-project:
	@$(FIREBASEUSE) venni-rider-staging

use-prod-project:
	@$(FIREBASEUSE) venni-rider-production

deploy-config: check-deploy-env
# create functions/.runtimeconfig.json file
	@$(FIREBASESET) functions.predeploy=$(FUNCTIONS_PREDEPLOY) && \
	$(FIREBASEGET) > firebase.json && \
	$(FIREBASESET) googleapi.key=$(GOOGLE_MAPS_API_KEY) && \
	$(FIREBASEGET) > functions/.runtimeconfig.json

emulator-config: check-emulator-env
# create firebase.json and functions/.runtimeconfig.json files
	@$(FIREBASESET) emulators.functions.port=$(EMULATORS_FUNCTIONS_PORT) \
	emulators.functions.host=$(EMULATORS_FUNCTIONS_HOST) \
	emulators.ui.enabled=$(EMULATORS_UI_ENABLED) && \
	$(FIREBASEGET) > firebase.json && \
	$(FIREBASESET) googleapi.key=$(GOOGLE_MAPS_API_KEY) && \
	$(FIREBASEGET) > functions/.runtimeconfig.json

test-config: check-test-env
	@$(FIREBASESET) googleapi.key=$(GOOGLE_MAPS_API_KEY) && \
	$(FIREBASEGET) > functions/.runtimeconfig.json


################################################################################
## BUILDING
################################################################################

# typescript is transpiled into javascript by executing npm run build
build: functions/devAdminCredentials.json
# exporting the credentials is not necessary for deploying but it doesn't hurt either
# so we keep it for other build targets that depend on it.
	export GOOGLE_APPLICATION_CREDENTIALS=$(shell pwd)/functions/devAdminCredentials.json && \
	$(NPMRUN) build

################################################################################
## TESTING
################################################################################
.PHONY: test-dependencies emulator test

test-dependencies:
	@$(NPMLIST) mocha &> /dev/null || $(NPM) install --save-dev mocha && \
	$(NPMLIST) chai &> /dev/null || $(NPM) install --save-dev chai && \
	$(NPMLIST) firebase-functions-test &> /dev/null || $(NPM) install --save-dev firebase-functions-test

# start the Firebase Local Emulator Suite with non-emulated services pointing to venni-rider-test project
emulator: use-dev-project emulator-config build
# install firebase-tools if it's not already installed
# start the emulator
	@$(NPMLIST) -g firebase-tools &> /dev/null || $(NPM) install -g firebase-tools && \
	firebase emulators:start
	

# start online testing with services pointing to test project
# should we want to update files to be tested, don't forget to set the
# GOOGLE_APPLICATION_CREDENTIALS and run $(NPMRUN) buid
# test: use-dev-project test-dependencies test-config
# 	$(NPMTEST)

test:
	$(NPMTEST)

################################################################################
## DEPLOYING
################################################################################
.PHONY: deploy-dev deploy-stag deploy-prod deploy

deploy:
ifdef DEPLOYGROUP
	$(FIREBASEDEPLOY) --only functions:$(DEPLOYGROUP)
else
ifdef FUNCTIONNAME
	$(FIREBASEDEPLOY) --only functions:$(FUNCTIONNAME)
else 
	$(FIREBASEDEPLOY) --only functions
endif
endif

deploy-dev: use-dev-project deploy-config build deploy

deploy-stag: use-stag-project deploy-config build deploy

deploy-prod: use-prod-project deploy-config build deploy



