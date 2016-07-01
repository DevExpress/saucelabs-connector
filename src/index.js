import Promise from 'pinkie';
import promisify from 'pify';
import request from 'request';
import SauceTunnel from 'sauce-tunnel';
import wd from 'wd';
import { format } from 'util';
import { assign } from 'lodash';
import wait from './utils/wait';
import SauceStorage from './sauce-storage';
import { toAbsPath } from 'read-file-relative';


const PRERUN_SCRIPT_DIR_PATH                        = toAbsPath('./prerun/');
const DISABLE_COMPATIBILITY_MODE_IE_SCRIPT_FILENAME = 'disable-intranet-compatibility-mode-in-ie.bat';

const WEB_DRIVER_IDLE_TIMEOUT              = 1000;
const WEB_DRIVER_PING_INTERVAL             = 5 * 60 * 1000;
const WEB_DRIVER_CONFIGURATION_RETRY_DELAY = 30 * 1000;
const WEB_DRIVER_CONFIGURATION_RETRIES     = 3;
const WEB_DRIVER_CONFIGURATION_TIMEOUT     = 9 * 60 * 1000;


var requestPromised = promisify(request, Promise);


export default class SaucelabsConnector {
    constructor (username, accessKey, options = { showBrowserStartMessage: true }) {
        this.username         = username;
        this.accessKey        = accessKey;
        this.tunnelIdentifier = Date.now();
        this.tunnel           = new SauceTunnel(this.username, this.accessKey, this.tunnelIdentifier);
        this.sauceStorage     = new SauceStorage(this.username, this.accessKey);

        wd.configureHttp({
            retryDelay: WEB_DRIVER_CONFIGURATION_RETRY_DELAY,
            retries:    WEB_DRIVER_CONFIGURATION_RETRIES,
            timeout:    WEB_DRIVER_CONFIGURATION_TIMEOUT
        });

        this.options = {
            showBrowserStartMessage: options.showBrowserStartMessage
        };
    }

    async _getFreeMachineCount () {
        var params = {
            method: 'GET',
            url:    ['https://saucelabs.com/rest/v1/users', this.username, 'concurrency'].join('/'),
            auth:   { user: this.username, pass: this.accessKey }
        };

        var response = await requestPromised(params);

        return JSON.parse(response.body).concurrency[this.username].remaining.overall;
    }

    async getSessionUrl (browser) {
        var sessionId = await browser.getSessionId();

        return `https://saucelabs.com/tests/${sessionId}`;
    }

    async startBrowser (browser, url, { jobName, tags, build } = {}, timeout = null) {
        var webDriver = wd.promiseChainRemote('ondemand.saucelabs.com', 80, this.username, this.accessKey);

        var pingWebDriver = () => webDriver.eval('');

        webDriver.once('status', () => {
            // HACK: if the webDriver doesn't get any command within 1000s, it fails
            // with the timeout error. We should send any command to avoid this.
            webDriver.pingIntervalId = setInterval(pingWebDriver, WEB_DRIVER_PING_INTERVAL);

            if (this.options.showBrowserStartMessage) {
                this
                    .getSessionUrl(webDriver)
                    .then(sessionUrl => process.stdout.write(`${browser.browserName} started. See ${sessionUrl}\n`));
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

    connect () {
        return new Promise((resolve, reject) => {
            this.tunnel.openTunnel(result => {
                if (result)
                    resolve();
                else
                    reject('Failed to open the tunnel.');
            });
        });
    }

    async disconnect () {
        var closeTunnel = promisify(this.tunnel.stop.bind(this.tunnel), Promise);

        await closeTunnel();
    }

    async waitForFreeMachines (machineCount, requestInterval, maxAttemptCount) {
        var attempts = 0;

        while (attempts < maxAttemptCount) {
            var freeMachineCount = await this._getFreeMachineCount();

            if (freeMachineCount >= machineCount)
                return;

            process.stdout.write(format('The number of free machines (%d) is less than requested (%d).\n',
                freeMachineCount, machineCount));

            await wait(requestInterval);
            attempts++;
        }

        throw new Error('There are no free machines');
    }
}
