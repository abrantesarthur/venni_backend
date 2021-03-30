SHELL=/bin/bash

NPM := npm --prefix ./functions

.PHONY: emulator test environment use-test-project use-default-project deploy deploy-test config

########## GENERAL

use-test-project:
	@firebase use venni-rider-test

use-default-project:
	@firebase use venni-rider-staging

config:
# set googlemaps.apikey from environment
	@firebase functions:config:set googleapi.key=$(GOOGLEAPIKEY)

emulator-config: config
# add configuration variables to the runtimeconfig so the emulator can access them
	@firebase functions:config:get > functions/.runtimeconfig.json


########## TESTING

dependencies:
	@$(NPM) list mocha &> /dev/null || $(NPM) install --save-dev mocha && \
	$(NPM) list firebase-functions-test &> /dev/null || $(NPM) install --save-dev firebase-functions-test

# start the Firebase Local Emulator Suite with non-emulated services pointing to test project
emulator: use-test-project ./functions/testAdminCredentials.json emulator-config
# install firebase-tools if it's not already installed
	@$(NPM) list -g firebase-tools &> /dev/null || $(NPM) install -g firebase-tools && \
	export GOOGLE_APPLICATION_CREDENTIALS=$(shell pwd)/functions/testAdminCredentials.json && \
	firebase emulators:start

# start online testing with services pointing to test project
test: dependencies functions/testAdminCredentials.json
	@$(NPM) test

########## DEPLOYING

deploy-test: use-test-project config
	firebase deploy

deploy: use-default-project config
	firebase deploy





