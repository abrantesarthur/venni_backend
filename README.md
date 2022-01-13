# Cloud Functions

## Description

This repository contains the cloud functions used in the Firebase backend of the Venni apps.

## Local Development

### Setup

For the commands below to work, you must properly set up the environment. First, following the [Initialize SDK in online mode](https://firebase.google.com/docs/functions/unit-testing?authuser=1) tutorial, add the specified service account's key file to the path `functions/devAdminCredentials.json`. This will grant permission for Cloud Functions to access other APIs such as Realtime Database when emulated.

Second, be sure to set a `GOOGLE_MAPS_API_KEY` environment variable containing a google maps API key crendential that can be used for the Directions API. This will allow functions to access the google maps APIs.

### Testing

Execute the following command to run the tests present in the `functions/test` folder.
TODO: how does this relate to make emulator

```bash
make test
```

### Emulating

Should you want to test how your functions behave before deploying them or even write end-to-end tests in your apps, you can start a local emulator by doing

```bash
make emulator
```

The emulator will run the Cloud Functions locally and its UI will be available in the port `4000`. Note that other firebase resources, such as Database, Authentication and Storage, will still run remotely in the project specified by the `functions/devAdminCredentials.json` file. You can send request to the emulator from your apps by using the `httpsCallable` method of the `FirebaseFunctions` flutter library.

### Deploying

To deploy to default project, do

```bash
make deploy
```

To deploy to the venni-rider-development project, do

```bash
make deploy-dev
```

In both cases, if the `DEPLOYGROUP` environment variable is set, only functions belonging to the specified group are deployed. Similarly, if `DEPLOYFUNCTION` is set, only the specified function is deployed.

**Important**: avoid usings these commands when deploying more than 10 functions at a time. Doing so may [exceed the standard quota](https://firebase.google.com/docs/functions/manage-functions) and receive HTTP 429 or 500 error messages. Instead, deploy each function manually.
