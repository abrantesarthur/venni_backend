# Cloud Functions

## Description

This repository contains the cloud functions used in the Firebase backend of the Venni apps.

## Local Development

### Setup

For the commands below to work, you must properly set up the environment. First, following the [Initialize SDK in online mode](https://firebase.google.com/docs/functions/unit-testing?authuser=1) tutorial, open the `venni-rider-test` project in the Firebase console add the specified service account's key file to the path `functions/testAdminCredentials.json`. This will grant permission for Cloud Functions to access other APIs such as Realtime Database when emulated.

Second, be sure to set a `GOOGLEAPIKEY` environment variable containing a google maps API key crendential that can be used for the Directions API. This will allow functions to access the google maps APIs.

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

This will start an emulator which will emulate the Cloud Functions and Firebase Realtime Database locally and whose UI will be available in the port `4000`. Note that other firebase resources, such as Authentication and Storage, will still run in the project specified by the `functions/testAdminCredentials.json` file.

In order to send requests to the emulated resources, you'll need to add a Bearer user identity token to the request Authorization header. You can retrieve this token by running the venni-rider app, signing in, and printing the result of calling `FirebaseAuth.instance.currentuser.getIdToken()` to the terminal.

### Deploying

To deploy to default project, do

```bash
make deploy
```

To deploy to the venni-rider-development project, do

```bash
make deploy-dev
```

In both cases, if the `DEPLOYGROUP` environment variable is set, only functions belonging to the specified group are deployed.

**Important**: avoid usings these commands when deploying more than 10 functions at a time. Doing so may [exceed the standard quota](https://firebase.google.com/docs/functions/manage-functions) and receive HTTP 429 or 500 error messages.
