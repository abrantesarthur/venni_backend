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
.PHONY: check-deploy-prod-env check-deploy-dev-env check-emulator-env check-test-env

check-dev-api-keys:
ifndef DEV_GOOGLE_MAPS_API_KEY
	$(error DEV_GOOGLE_MAPS_API_KEY is undefined)
endif
ifndef DEV_PAGARME_API_KEY
	$(error DEV_PAGARME_API_KEY is undefined)
endif
ifndef DEV_PAGARME_API_RECIPIENT_ID
	$(error DEV_PAGARME_API_RECIPIENT_ID is undefined)
endif
ifndef DEV_AMPLITUDE_API_KEY
	$(error DEV_AMPLITUDE_API_KEY is undefined)
endif

check-prod-api-keys:
ifndef GOOGLE_MAPS_API_KEY
	$(error GOOGLE_MAPS_API_KEY is undefined)
endif
ifndef PAGARME_API_KEY
	$(error PAGARME_API_KEY is undefined)
endif
ifndef PAGARME_API_RECIPIENT_ID
	$(error PAGARME_API_RECIPIENT_ID is undefined)
endif
ifndef AMPLITUDE_API_KEY
	$(error AMPLITUDE_API_KEY is undefined)
endif

check-deploy-prod-env: check-prod-api-keys
ifndef FUNCTIONS_PREDEPLOY
	$(error FUNCTIONS_PREDEPLOY is undefined)
endif


check-deploy-dev-env: check-dev-api-keys
ifndef FUNCTIONS_PREDEPLOY
	$(error FUNCTIONS_PREDEPLOY is undefined)
endif

check-emulator-env: check-dev-api-keys
ifndef EMULATORS_FUNCTIONS_PORT
	$(error EMULATORS_FUNCTIONS_PORT is undefined)
endif
ifndef EMULATORS_FUNCTIONS_HOST
	$(error EMULATORS_FUNCTIONS_HOST is undefined)
endif
ifndef EMULATORS_UI_ENABLED
	$(error EMULATORS_UI_ENABLED is undefined)
endif



################################################################################
## FIREBASE CONFIGS
################################################################################
.PHONY: use-dev-project use-prod-project deploy-prod-config deploy-dev-config emulator-config test-config

use-dev-project:
	@$(FIREBASEUSE) venni-rider-development-8a3f8

use-prod-project:
	@$(FIREBASEUSE) venni-production

deploy-prod-config: check-deploy-prod-env
# create functions/.runtimeconfig.json file
	@$(FIREBASESET) functions.predeploy=$(FUNCTIONS_PREDEPLOY) && \
	$(FIREBASEGET) > firebase.json && \
	$(FIREBASESET) googleapi.key=$(GOOGLE_MAPS_API_KEY) && \
	$(FIREBASESET) pagarmeapi.key=$(PAGARME_API_KEY) && \
	$(FIREBASESET) pagarmeapi.recipient_id=$(PAGARME_API_RECIPIENT_ID) && \
	$(FIREBASESET) amplitudeapi.key=$(AMPLITUDE_API_KEY) && \
	$(FIREBASEGET) > functions/.runtimeconfig.json

deploy-dev-config: check-deploy-dev-env
# create functions/.runtimeconfig.json file
	@$(FIREBASESET) functions.predeploy=$(FUNCTIONS_PREDEPLOY) && \
	$(FIREBASEGET) > firebase.json && \
	$(FIREBASESET) googleapi.key=$(DEV_GOOGLE_MAPS_API_KEY) && \
	$(FIREBASESET) pagarmeapi.key=$(DEV_PAGARME_API_KEY) && \
	$(FIREBASESET) pagarmeapi.recipient_id=$(DEV_PAGARME_API_RECIPIENT_ID) && \
	$(FIREBASESET) amplitudeapi.key=$(DEV_AMPLITUDE_API_KEY) && \
	$(FIREBASEGET) > functions/.runtimeconfig.json

emulator-config: check-emulator-env
# create firebase.json and functions/.runtimeconfig.json files
	@$(FIREBASESET) emulators.functions.port=$(EMULATORS_FUNCTIONS_PORT) \
	emulators.functions.host=$(EMULATORS_FUNCTIONS_HOST) \
	emulators.ui.enabled=$(EMULATORS_UI_ENABLED) && \
	$(FIREBASEGET) > firebase.json && \
	$(FIREBASESET) googleapi.key=$(DEV_GOOGLE_MAPS_API_KEY) && \
	$(FIREBASESET) pagarmeapi.key=$(DEV_PAGARME_API_KEY) && \
	$(FIREBASESET) pagarmeapi.recipient_id=$(DEV_PAGARME_API_RECIPIENT_ID) && \
	$(FIREBASESET) amplitudeapi.key=$(DEV_AMPLITUDE_API_KEY) && \
	$(FIREBASEGET) > functions/.runtimeconfig.json

test-config: check-dev-api-keys
	@$(FIREBASESET) googleapi.key=$(DEV_GOOGLE_MAPS_API_KEY) && \
	$(FIREBASESET) pagarmeapi.key=$(DEV_PAGARME_API_KEY) && \
	$(FIREBASESET) pagarmeapi.recipient_id=$(DEV_PAGARME_API_RECIPIENT_ID) && \
	$(FIREBASESET) amplitudeapi.key=$(DEV_AMPLITUDE_API_KEY) && \
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
	firebase emulators:start --only functions
	

# start online testing with services pointing to test project
# the environment used for tests is development, which is determined when we initialize
# "firebaseFunctionsTest" in trip.test.js, where we pass the path to devAdminCredentials.json
# test: test-dependencies test-config build
# 	$(NPMTEST)
test: functions/devAdminCredentials.json
	$(NPMTEST)


################################################################################
## DEPLOYING
################################################################################
.PHONY: deploy-dev deploy-stag deploy-prod deploy

deploy:
ifdef DEPLOYFUNCTION
	$(FIREBASEDEPLOY) --only functions:$(DEPLOYFUNCTION)
else 
ifdef DEPLOYGROUP
	$(FIREBASEDEPLOY) --only functions:$(DEPLOYGROUP)
else
	$(FIREBASEDEPLOY) --only functions
endif
endif

deploy-dev: use-dev-project deploy-dev-config deploy

deploy-prod: use-prod-project deploy-prod-config deploy
