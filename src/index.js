import Promise from 'pinkie';
import promisify from 'pify';
import request from 'request';
import wd from 'wd';
import { assign } from 'lodash';
import wait from './utils/wait';
import { toAbsPath } from 'read-file-relative';
import sauceConnectLauncher from 'sauce-connect-launcher';
import SauceStorage from './sauce-storage';
import { SAUCE_API_HOST } from './sauce-host';


const PRERUN_SCRIPT_DIR_PATH                        = toAbsPath('./prerun/');
const DISABLE_COMPATIBILITY_MODE_IE_SCRIPT_FILENAME = 'disable-intranet-compatibility-mode-in-ie.bat';

const WEB_DRIVER_IDLE_TIMEOUT              = 1000;
const WEB_DRIVER_PING_INTERVAL             = 5 * 60 * 1000;
const WEB_DRIVER_CONFIGURATION_RETRY_DELAY = 30 * 1000;
const WEB_DRIVER_CONFIGURATION_RETRIES     = 3;
const WEB_DRIVER_CONFIGURATION_TIMEOUT     = 9 * 60 * 1000;

// NOTE: When using Appium on Android devices, the device browser navigates to 'https://google.com' after being started.
// So we need to route traffic directly to Google servers to avoid re-signing it with Saucelabs SSL certificates.
// https://support.saucelabs.com/customer/portal/articles/2005359-some-https-sites-don-t-work-correctly-under-sauce-connect
const DEFAULT_DIRECT_DOMAINS = ['*.google.com', '*.gstatic.com', '*.googleapis.com'];

const requestPromised = promisify(request, Promise);

function createSauceConnectProcess (options) {
    return new Promise((resolve, reject) => {
        sauceConnectLauncher(options, (err, process) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(process);
        });
    });
}

function disposeSauceConnectProcess (process) {
    return new Promise(resolve => {
        process.close(resolve);
    });
}

export default class SaucelabsConnector {
    constructor (username, accessKey, options = {}) {
        this.username         = username;
        this.accessKey        = accessKey;
        this.tunnelIdentifier = Date.now();

        var {
            connectorLogging = true,
            tunnelLogging    = false,
            directDomains    = DEFAULT_DIRECT_DOMAINS,
            noSSLBumpDomains = []
        } = options;

        this.sauceConnectOptions = {
            username:         this.username,
            accessKey:        this.accessKey,
            tunnelIdentifier: this.tunnelIdentifier,
            directDomains:    directDomains.join(','),
            logfile:          tunnelLogging ? 'sc_' + this.tunnelIdentifier + '.log' : null
        };

        if (process.env.HTTP_PROXY) {
            this.sauceConnectOptions = Object.assign({}, this.sauceConnectOptions, {
                proxy:       process.env.HTTP_PROXY.replace(/(^\w+:|^)\/\//, ''),
                proxyTunnel: true
            });
        }

        if (noSSLBumpDomains.length)
            this.sauceConnectOptions.noSslBumpDomains = noSSLBumpDomains.join(',');

        this.sauceConnectProcess = null;

        this.sauceStorage = new SauceStorage(this.username, this.accessKey);

        wd.configureHttp({
            retryDelay: WEB_DRIVER_CONFIGURATION_RETRY_DELAY,
            retries:    WEB_DRIVER_CONFIGURATION_RETRIES,
            timeout:    WEB_DRIVER_CONFIGURATION_TIMEOUT
        });

        this.options = { connectorLogging };
    }

    _log (message) {
        if (this.options.connectorLogging)
            process.stdout.write(message + '\n');
    }

    async _getFreeMachineCount () {
        var params = {
            method: 'GET',
            url:    [`https://${SAUCE_API_HOST}/rest/v1/users`, this.username, 'concurrency'].join('/'),
            auth:   { user: this.username, pass: this.accessKey }
        };

        var response = await requestPromised(params);

        return JSON.parse(response.body).concurrency[this.username].remaining.overall;
    }

    async getSessionUrl (browser) {
        var sessionId = await browser.getSessionId();

        return `https://app.${SAUCE_API_HOST}/tests/${sessionId}`;
    }

    async startBrowser (browser, url, { jobName, tags, build } = {}, timeout = null) {
        var webDriver = wd.promiseChainRemote(`ondemand.${SAUCE_API_HOST}`, 80, this.username, this.accessKey);

        var pingWebDriver = () => webDriver.eval('');

        webDriver.once('status', () => {
            // HACK: if the webDriver doesn't get any command within 1000s, it fails
            // with the timeout error. We should send any command to avoid this.
            webDriver.pingIntervalId = setInterval(pingWebDriver, WEB_DRIVER_PING_INTERVAL);

            if (this.options.connectorLogging) {
                this
                    .getSessionUrl(webDriver)
                    .then(sessionUrl => this._log(`${browser.browserName} started. See ${sessionUrl}`));
            }
        });

        var initParams = {
            name:             jobName,
            tags:             tags,
            build:            build,
            tunnelIdentifier: this.tunnelIdentifier,
            idleTimeout:      WEB_DRIVER_IDLE_TIMEOUT
        };

        assign(initParams, browser);

        if (timeout)
            initParams.maxDuration = timeout;


        // NOTE: If IE11 is used, the "Display intranet sites in Compatibility View" option should be disabled.
        // We do this this via the 'prerun' parameter, which should run our script on the Sauce Labs side,
        // before the browser starts.
        if (browser.browserName.toLowerCase() === 'internet explorer' && /11(\.\d*)?$/.test(browser.version)) {
            // NOTE: We should upload the script to the sauce storage if it's not there yet.
            if (!await this.sauceStorage.isFileAvailable(DISABLE_COMPATIBILITY_MODE_IE_SCRIPT_FILENAME))
                await this.sauceStorage.uploadFile(PRERUN_SCRIPT_DIR_PATH, DISABLE_COMPATIBILITY_MODE_IE_SCRIPT_FILENAME);

            initParams.prerun = `sauce-storage:${DISABLE_COMPATIBILITY_MODE_IE_SCRIPT_FILENAME}`;
        }

        await webDriver
            .init(initParams)
            .get(url);

        return webDriver;
    }

    async stopBrowser (browser) {
        clearInterval(browser.pingIntervalId);

        await browser
            .quit()
            .sauceJobStatus();
    }
    async connect () {
        this.sauceConnectProcess = await createSauceConnectProcess(this.sauceConnectOptions);
    }

    async disconnect () {
        await disposeSauceConnectProcess(this.sauceConnectProcess);
    }

    async waitForFreeMachines (machineCount, requestInterval, maxAttemptCount) {
        var attempts = 0;

        while (attempts < maxAttemptCount) {
            var freeMachineCount = await this._getFreeMachineCount();

            if (freeMachineCount >= machineCount)
                return;

            this._log(`The number of free machines (${freeMachineCount}) is less than requested (${machineCount}).`);

            await wait(requestInterval);
            attempts++;
        }

        throw new Error('There are no free machines');
    }
}
