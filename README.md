# saucelabs-connector

Helps connect the local machine to SauceLabs and start a remote browser.

##Install

`$ npm install saucelabs-connector`

##Usage
```js

var SauceLabsConnector = require('saucelabs-connector');

// Use this online tool to generate a valid platform configuration: 
// https://wiki.saucelabs.com/display/DOCS/Platform+Configurator#/
var browserInfo = {
    platform:    'Windows 10',
    browserName: 'chrome'
};

var pageUrl = 'www.example.com';
var jobName = 'Sample tests';

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
        // Starts a remote browser on SauceLabs with the specified url
        return saucelabsConnector.startBrowser(browserInfo, pageUrl, jobName);
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