# saucelabs-connector

Helps connect the local machine to SauceLabs and start a remote browser.

## Install

`$ npm install saucelabs-connector`

## Usage
```js

var SauceLabsConnector = require('saucelabs-connector');

// Use this online tool to generate a valid platform configuration: 
// https://wiki.saucelabs.com/display/DOCS/Platform+Configurator#/
var browserInfo = {
    platform:    'Windows 10',
    browserName: 'chrome',
    version:     '45.0'
};

var pageUrl    = 'www.example.com';
var jobTimeout = 60; // in seconds
var jobOptions = {
    jobName: 'Sample tests',
    build:   'build-1234',
    tags:    ['tag1', 'tag2', 'tag3']
};

var saucelabsConnector = new SauceLabsConnector('SAUCELABS_USERNAME', 'SAUCELABS_ACCESS_KEY');
var saucelabsBrowser   = null;

// Connects the local machine to SauceLabs
saucelabsConnector
    .connect()
    .then(function () {
        // Use the waitForFreeMachines method to ensure that the required number of machines is available.
        var machineCount    = 3;     // the required number of machines.
        var requestInterval = 30000; // the request delay in milliseconds.
        var maxAttemptCount = 5;     // the maximum number of attempts.
        
        return saucelabsConnector.waitForFreeMachines(machineCount, requestInterval, maxAttemptCount);
    })
    .then(function () {
        // Starts a remote browser on SauceLabs with the specified url.
        // jobOptions and jobTimeout are optional arguments.
        return saucelabsConnector.startBrowser(browserInfo, pageUrl, jobOptions, jobTimeout);
    })
    .then(function (browser) {
        saucelabsBrowser = browser;
        // Do some work with the browser
    })
    .then(function () {
        // Closes the browser
        return saucelabsConnector.stopBrowser(saucelabsBrowser);
    })
    .then(function () {
        return saucelabsConnector.disconnect();
    });
```

## Additional Configuration

You can select the data center you want to connect to, by setting the environment variable `SAUCE_API_HOST` 
to the respective data center's host: 

```bash
export SAUCE_API_HOST=saucelabs.com # for us-west-1, default
export SAUCE_API_HOST=eu-central-1.saucelabs.com # for eu-central-1
```
