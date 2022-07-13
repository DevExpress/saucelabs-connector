import { promisify } from 'util';
import got from 'got';
import wd from 'wd';
import wait from './utils/wait';
import { toAbsPath } from 'read-file-relative';
import sauceConnectLauncher from 'sauce-connect-launcher';
import SauceStorage from './sauce-storage';
import { SAUCE_API_HOST } from './sauce-host';
import isIE11 from './utils/is-ie11';
import { MESSAGE, getText } from './messages';


const PRERUN_SCRIPT_DIR_PATH                        = toAbsPath('./prerun/');
const DISABLE_COMPATIBILITY_MODE_IE_SCRIPT_FILENAME = 'disable-intranet-compatibility-mode-in-ie.bat';

const WEB_DRIVER_IDLE_TIMEOUT              = 1000;
const WEB_DRIVER_PING_INTERVAL             = 5 * 60 * 1000;
const WEB_DRIVER_CONFIGURATION_RETRY_DELAY = 30 * 1000;
const WEB_DRIVER_CONFIGURATION_RETRIES     = 3;
const WEB_DRIVER_CONFIGURATION_TIMEOUT     = 9 * 60 * 1000;

const SAUCE_API_PORT                 = 80;
const SAUCE_CONNECT_OPTIONS_DENYLIST = [
    'createTunnel',
    'connectorLogging'
];

// NOTE: When using Appium on Android devices, the device browser navigates to 'https://google.com' after being started.
// So we need to route traffic directly to Google servers to avoid re-signing it with Saucelabs SSL certificates.
// https://support.saucelabs.com/customer/portal/articles/2005359-some-https-sites-don-t-work-correctly-under-sauce-connect
const DEFAULT_DIRECT_DOMAINS = ['*.google.com', '*.gstatic.com', '*.googleapis.com'];

const createSauceConnect  = promisify(sauceConnectLauncher);
const disposeSauceConnect = promisify((process, ...args) => process.close(...args));


export default class SaucelabsConnector {
    constructor (username, accessKey, options = {}) {
        const timestamp = Date.now();

        const {
            createTunnel     = true,
            connectorLogging = true,
        } = options;

        this.options = { connectorLogging, createTunnel };

        const {
            tunnelLogging    = false,
            tunnelIdentifier = createTunnel ? timestamp : void 0,
            logfile          = 'sc_' + (tunnelIdentifier || timestamp) + '.log',
            directDomains    = DEFAULT_DIRECT_DOMAINS,
            noSSLBumpDomains = []
        } = options;

        this.username            = username;
        this.accessKey           = accessKey;
        this.tunnelIdentifier    = tunnelIdentifier;
        this.sauceConnectOptions = null;
        this.sauceConnectProcess = null;

        if (createTunnel) {
            // NOTE: we remove our internal options from the Sauce Connect options
            const sauceConnectOptions = SaucelabsConnector._getFilteredSauceConnectOptions(options);

            this.sauceConnectOptions = {
                ...sauceConnectOptions,

                username:         this.username,
                accessKey:        this.accessKey,
                tunnelIdentifier: this.tunnelIdentifier,
                logfile:          tunnelLogging ? logfile : null,

                ...noSSLBumpDomains.length && {
                    noSSLBumpDomains: noSSLBumpDomains.join(',')
                },

                ...directDomains.length && {
                    directDomains: directDomains.join(',')
                },
                
                ...process.env.HTTP_PROXY && {
                    proxy      : process.env.HTTP_PROXY.replace(/(^\w+:|^)\/\//, '');
                    proxyTunnel: true;
                }
            };
        }

        this.sauceStorage = new SauceStorage(this.username, this.accessKey);

        wd.configureHttp({
            retryDelay: WEB_DRIVER_CONFIGURATION_RETRY_DELAY,
            retries:    WEB_DRIVER_CONFIGURATION_RETRIES,
            timeout:    WEB_DRIVER_CONFIGURATION_TIMEOUT
        });
    }

    static _getFilteredSauceConnectOptions (options) {
        return Object.keys(options)
            .filter(key => SAUCE_CONNECT_OPTIONS_DENYLIST.indexOf(key) === -1)
            .reduce((obj, key) => {
                obj[key] = options[key];
                return obj;
            }, {});
    }

    _log (message) {
        if (this.options.connectorLogging)
            process.stdout.write(message + '\n');
    }

    _getFreeMachineCount () {
        const params = {
            method:   'GET',
            url:      [`https://${SAUCE_API_HOST}/rest/v1.2/users`, this.username, 'concurrency'].join('/'),
            username: this.username,
            password: this.accessKey
        };

        return got(params)
            .then(response => {
                /* At the moment of the 28.04.21 - 5 MAC VMS (mac_vms) and 5 Windows VMS (vms) can be allocated independently
                 * In this situation the site interface will show that 10/5 virtual devices are occupied
                 * TODO: Make _getFreeMachineCount separate for Windows VMS and for Mac VMS
                 */

                const concurrency = JSON.parse(response.body).concurrency;
                const orgFreeWindowsMachineCount = concurrency.organization.allowed.vms - concurrency.organization.current.vms;
                const orgFreeMacMachineCount = concurrency.organization.allowed.mac_vms - concurrency.organization.current.mac_vms;
                const orgFreeMachineCount = Math.min(orgFreeWindowsMachineCount, orgFreeMacMachineCount);
                const teamFreeWindowsMachineCount = concurrency.team.allowed.vms - concurrency.team.current.vms;
                const teamFreeMacMachineCount = concurrency.team.allowed.mac_vms - concurrency.team.current.mac_vms;
                const teamFreeMachineCount = Math.min(teamFreeWindowsMachineCount, teamFreeMacMachineCount);

                return Math.min(orgFreeMachineCount, teamFreeMachineCount);
            })
            .catch(err => {
                throw new Error(getText(MESSAGE.failedToCallSauceApi, { err }));
            });
    }

    async getSessionUrl (browser) {
        const sessionId = await browser.getSessionId();

        return `https://app.${SAUCE_API_HOST}/tests/${sessionId}`;
    }

    async startBrowser (browser, url, jobOptions = {}, timeout = null) {
        jobOptions = { ...jobOptions, ...browser };

        const webDriver = wd.promiseChainRemote(`ondemand.${SAUCE_API_HOST}`, SAUCE_API_PORT, this.username, this.accessKey);

        const pingWebDriver = () => webDriver.eval('');

        webDriver.once('status', () => {
            // HACK: if the webDriver doesn't get any command within 1000s, it fails
            // with the timeout error. We should send any command to avoid this.
            webDriver.pingIntervalId = setInterval(pingWebDriver, WEB_DRIVER_PING_INTERVAL);

            if (this.options.connectorLogging) {
                this
                    .getSessionUrl(webDriver)
                    .then(sessionUrl => this._log(getText(MESSAGE.browserStarted, { browserName: browser.browserName, sessionUrl })));
            }
        });

        const {
            idleTimeout = WEB_DRIVER_IDLE_TIMEOUT,

            name             = jobOptions.jobName,
            tunnelIdentifier = this.tunnelIdentifier,

            ...additionalOptions
        } = jobOptions;

        const initParams = {
            ...additionalOptions,

            idleTimeout,

            ...name && {
                name
            },

            ...tunnelIdentifier && {
                tunnelIdentifier
            },

            ...timeout && {
                maxDuration: timeout
            }
        };

        // NOTE: If IE11 is used, the "Display intranet sites in Compatibility View" option should be disabled.
        // We do this this via the 'prerun' parameter, which should run our script on the Sauce Labs side,
        // before the browser starts.
        if (isIE11(browser)) {
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
        this.sauceConnectProcess = this.options.createTunnel ? await createSauceConnect(this.sauceConnectOptions) : null;
    }

    async disconnect () {
        if (this.sauceConnectProcess)
            await disposeSauceConnect(this.sauceConnectProcess);
    }

    async waitForFreeMachines (machineCount, requestInterval, maxAttemptCount) {
        let attempts = 0;

        while (attempts++ < maxAttemptCount) {
            const freeMachineCount = await this._getFreeMachineCount();

            if (freeMachineCount >= machineCount)
                return;

            this._log(getText(MESSAGE.freeMachinesNumberIsLessThanRequested, { freeMachineCount, machineCount }));

            await wait(requestInterval);
        }

        throw new Error(MESSAGE.noFreeMachines);
    }
}
