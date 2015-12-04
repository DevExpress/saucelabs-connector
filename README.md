# saucelabs-connector

Module that helps to connect local machine to the SauceLabs and start remote browser with specific url.

##Install

`$ npm install saucelabs-connector

##Usage
```js

var SauceLabsConnector = require('saucelabs-connector');

var saucelabsConnector = new SauceLabsConnector('YOUR_USERNAME','YOUR_ACCESSKEY');


// Connecting local machine to the SauceLabs

saucelabsConnector.connect()  // returns Promise
// In case of failure Promise rejects with message 'Failed to open the tunnel' 


// Starting remote browser on the Saucelabs with specified url

// Configure browsers here: https://docs.saucelabs.com/reference/platforms-configurator/
var browser = 
    {
        platform:    'Windows 10',
        browserName: 'chrome'
    }

var url     = 'www.example.com';
var jobName = 'www.example.com tests';

saucelabsConnector.startBrowser(browser, url, jobName) // returns Promise
// In case of success Promise resolve webdriver object, in the same time on the SauceLabs starts browser with specified url and job name.
// In case of failure Promise rejects with internal message.


// Closing browser

saucelabsConnector.stopBrowser(browser) // returns Promise
// browser is a webdriver object


// Waiting for free machines

saucelabsConnector.waitForFreeMachines(machinesCount, requestInterval, maxAttemptsCount) // returns Promise
// machinesCount - number, the amount of needed machines. 
// requestInterval - number, request delay in milliseconds.
// maxAttemptsCount - number, maximum count of attempts.
// Promise resolves immediately, when count of available machines become that we needed. It rejects when all attempts tried without success.
// We can use this method, if we need several machines but unsure, that count is available.


// Disconnecting
saucelabsConnector.disconnect() // returns Promise