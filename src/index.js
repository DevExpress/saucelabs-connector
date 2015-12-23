import SauceTunnel from 'sauce-tunnel';
import wd from 'wd';
import promisify from 'es6-promisify';
import { Promise } from 'es6-promise';
import request from 'request';
import denodeify from 'denodeify';
import { format } from 'util';
import wait from './utils/wait';


const WEB_DRIVER_IDLE_TIMEOUT              = 1000;
const WEB_DRIVER_PING_INTERVAL             = 900;
const WEB_DRIVER_CONFIGURATION_RETRY_DELAY = 30 * 1000;
const WEB_DRIVER_CONFIGURATION_RETRIES     = 3;
const WEB_DRIVER_CONFIGURATION_TIMEOUT     = 9 * 60 * 1000;


var requestPromised = denodeify(request);


export default class SaucelabsConnector {
    constructor (username, accessKey) {
        this.username         = username;
        this.accessKey        = accessKey;
        this.tunnelIdentifier = Date.now();
        this.tunnel           = new SauceTunnel(this.username, this.accessKey, this.tunnelIdentifier);

        wd.configureHttp({
            retryDelay: WEB_DRIVER_CONFIGURATION_RETRY_DELAY,
            retries:    WEB_DRIVER_CONFIGURATION_RETRIES,
            timeout:    WEB_DRIVER_CONFIGURATION_TIMEOUT
        });
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

    async startBrowser (browser, url, jobName, timeout = null) {
        var webDriver = wd.promiseChainRemote('ondemand.saucelabs.com', 80, this.username, this.accessKey);

        var getSessionId  = promisify(webDriver.getSessionId.bind(webDriver));
        var pingWebDriver = () => webDriver.elementById('x');

        webDriver.once('status', () => {
            getSessionId()
                .then(sid => {
                    process.stdout.write('Browser started. See https://saucelabs.com/tests/' + sid + '\n');

                    // HACK: if the webDriver doesn't get any command within 1000s, it fails
                    // with the timeout error. We should send any command to avoid this.
                    webDriver.pingIntervalId = setInterval(pingWebDriver, WEB_DRIVER_PING_INTERVAL);
                });
        });

        var initParams = {
            name:             jobName,
            platform:         browser.platform,
            browserName:      browser.browserName,
            version:          browser.version,
            tunnelIdentifier: this.tunnelIdentifier,
            idleTimeout:      WEB_DRIVER_IDLE_TIMEOUT
        };

        if (timeout)
            initParams.maxDuration = timeout;

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
        var closeTunnel = promisify(this.tunnel.stop.bind(this.tunnel));

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
