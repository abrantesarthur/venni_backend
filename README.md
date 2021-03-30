# Cloud Functions

## Description

This repository contains the cloud functions used in the Firebase backend of the Venni apps.

## Local Development

### Setup

For the commands below to work, you must properly set up the environment. First, following the [Initialize SDK in online mode](https://firebase.google.com/docs/functions/unit-testing?authuser=1) tutorial, open the `venni-rider-test` project in the Firebase console add the key file specified in the tutorial in the path `functions/testAdminCredentials.json`.

Second, be sure to set a `GOOGLEAPIKEY` environment variable containing a google maps API key crendential that can be used for the Directions API.

### Testing

Execute the following command to run the tests present in the `functions/test` folder.

```bash
make test
```

### Emulating

Should you want to test how your functions behave before deploying them or even write end-to-end tests in your apps, you can start a local emulator. You can then send requests to it rather than to the production environment.

```bash
make emulator
```

### Deploying
