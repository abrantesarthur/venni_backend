SHELL=/bin/bash

NPM := npm --prefix ./functions

.PHONY: emulator test environment use-dev-project use-default-project deploy deploy-dev config

########## ENVIRONMENT VARIABLES


########## CONFIG

check-env:
ifndef GOOGLE_API_KEY
	$(error GOOGLE_API_KEY is undefined)
endif

use-dev-project:
	@firebase use venni-rider-development

use-default-project:
	@firebase use venni-rider-staging

config: check-env
# set googlemaps.apikey from environment
	@firebase functions:config:set googleapi.key=$(GOOGLE_API_KEY)

emulator-config: config
# add configuration variables to the runtimeconfig so the emulator can access them
	@firebase functions:config:set runmode.value=TEST && \
	firebase functions:config:set emulator.authendpoint=$(FIREBASE_AUTH_EMULATOR_HOST) && \
	firebase functions:config:get > functions/.runtimeconfig.json



########## TESTING

dependencies:
	@$(NPM) list mocha &> /dev/null || $(NPM) install --save-dev mocha && \
	$(NPM) list firebase-functions-test &> /dev/null || $(NPM) install --save-dev firebase-functions-test

# start the Firebase Local Emulator Suite with non-emulated services pointing to venni-rider-test project
emulator: use-dev-project ./functions/testAdminCredentials.json emulator-config
# install firebase-tools if it's not already installed
# export service account credentials so functions can access the APIs not being emulated
# typescript is transpiled into javascript by executing npm run build
# start the emulator
	@$(NPM) list -g firebase-tools &> /dev/null || $(NPM) install -g firebase-tools && \
	export GOOGLE_APPLICATION_CREDENTIALS=$(shell pwd)/functions/testAdminCredentials.json && \
	npm --prefix functions run build && \
	firebase emulators:start
	

# start online testing with services pointing to test project
test: dependencies functions/testAdminCredentials.json
	@$(NPM) test

########## DEPLOYING

deploy-dev: use-dev-project config
ifndef DEPLOYGROUP
	firebase deploy --only functions
else
	firebase deploy --only functions:$(DEPLOYGROUP)
endif

deploy: use-default-project config
ifndef DEPLOYGROUP
	firebase deploy --only functions
else 
	firebase deploy --only functions:$(DEPLOYGROUP)
endif



