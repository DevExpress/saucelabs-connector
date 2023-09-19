import wd from 'webdriver';
import sauceConnect from 'sauce-connect-launcher';
import SauceConnector from '../lib';

jest.mock('webdriver');
jest.mock('sauce-connect-launcher');

class BrowserMock {
    constructor (args) {
        this.args = args;
        this.url  = '';
        this.subscribedEvents = [];
    }

    once (event) {
        this.subscribedEvents.push(event);
    }

    navigateTo (url) {
        this.url = url;

        return Promise.resolve();
    }
}

test('Should handle custom options', async () => {
    let connectorOptions = null;

    jest.spyOn(Date, 'now').mockImplementationOnce(() => Date.UTC(2007, 1, 1));

    wd.newSession.mockImplementationOnce((args) => new BrowserMock(args));

    sauceConnect.mockImplementationOnce((opts, cb) => {
        connectorOptions = opts;

        cb(null , {});
    });

    const sauceConnector = new SauceConnector('user', 'pass', {
        verbose: false,
        verboseDebugging: false,
        vv: false
    });

    expect(sauceConnector.options.connectorLogging).toEqual(true);
    expect(sauceConnector.options.createTunnel).toEqual(true);

    await sauceConnector.connect();

    expect(connectorOptions.username).toEqual('user');
    expect(connectorOptions.accessKey).toEqual('pass');
    expect(connectorOptions.tunnelIdentifier).toEqual(Date.UTC(2007, 1, 1));
    expect(connectorOptions.logfile).toEqual(null);
    expect(connectorOptions.directDomains).toEqual('*.google.com,*.gstatic.com,*.googleapis.com');
    expect(connectorOptions.verbose).toEqual(false);
    expect(connectorOptions.verboseDebugging).toEqual(false);
    expect(connectorOptions.vv).toEqual(false);

    const browser = await sauceConnector.startBrowser(
        { browserName: 'chrome' },
        'http://example.com',
        { jobName: 'job-name' },
        4242
    );

    expect(browser).toBeInstanceOf(BrowserMock);
    expect(browser.args.hostname).toEqual('ondemand.saucelabs.com');
    expect(browser.args.port).toEqual(80);
    expect(browser.args.user).toEqual('user');
    expect(browser.args.key).toEqual('pass');
    expect(browser.subscribedEvents).toEqual(['request.performance']);
    expect(browser.url).toEqual('http://example.com');
    expect(browser.args.capabilities.browserName).toEqual('chrome');
    expect(browser.args.capabilities.name).toEqual('job-name');
    expect(browser.args.capabilities.tunnelIdentifier).toEqual(Date.UTC(2007, 1, 1));
    expect(browser.args.capabilities.idleTimeout).toEqual(1000);
    expect(browser.args.capabilities.maxDuration).toEqual(4242);
});

test('Should not create a tunnel if createTunnel is false', async () => {
    let connectorOptions = null;

    jest.spyOn(Date, 'now').mockImplementationOnce(() => Date.UTC(2007, 1, 1));

    sauceConnect.mockImplementationOnce((opts, cb) => {
        connectorOptions = opts;

        cb(null, {});
    });

    wd.newSession.mockImplementationOnce((args) => new BrowserMock(args));

    const sauceConnector = new SauceConnector('user', 'pass', {
        createTunnel: false
    });

    expect(sauceConnector.options.createTunnel).toEqual(false);
    expect(sauceConnector.sauceConnectOptions).toEqual(null);

    await sauceConnector.connect();

    expect(sauceConnector.sauceConnectProcess).toEqual(null);
    expect(connectorOptions).toEqual(null);

    const browser = await sauceConnector.startBrowser(
        { browserName: 'chrome' },
        'http://example.com',
        { jobName: 'job-name' },
        4242
    );

    expect(browser.args.capabilities).not.toHaveProperty('tunnelIdentifier');

    await sauceConnector.disconnect();
});


test('Should allow using external tunnel', async () => {
    let connectorOptions = null;

    jest.spyOn(Date, 'now').mockImplementationOnce(() => Date.UTC(2007, 1, 1));

    sauceConnect.mockImplementationOnce((opts, cb) => {
        connectorOptions = opts;

        cb(null, {});
    });

    wd.newSession.mockImplementationOnce((args) => new BrowserMock(args));

    const sauceConnector = new SauceConnector('user', 'pass', {
        createTunnel:     false,
        tunnelIdentifier: 'ABRACADABRA'
    });

    expect(sauceConnector.options.createTunnel).toEqual(false);
    expect(sauceConnector.sauceConnectOptions).toEqual(null);

    await sauceConnector.connect();

    expect(sauceConnector.sauceConnectProcess).toEqual(null);
    expect(connectorOptions).toEqual(null);

    const browser = await sauceConnector.startBrowser(
        { browserName: 'chrome' },
        'http://example.com',
        { jobName: 'job-name' },
        4242
    );

    expect(browser.args.capabilities.tunnelIdentifier).toEqual('ABRACADABRA');

    await sauceConnector.disconnect();
});
