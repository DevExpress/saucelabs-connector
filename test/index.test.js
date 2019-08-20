import wd from 'wd';
import sauceConnect from 'sauce-connect-launcher';
import SauceConnector from '../lib';

jest.mock('wd');
jest.mock('sauce-connect-launcher');

class BrowserMock {
    constructor (args) {
        this.args = args;
        this.opts = null;
        this.url  = '';
        this.subscribedEvents = [];
    }

    once (event) {
        this.subscribedEvents.push(event);
    }

    init (opts) {
        this.opts = opts;

        return this;
    }

    get (url) {
        this.url = url;

        return Promise.resolve();
    }
}

test('Should handle custom options', async () => {
    let connectorOptions = null;

    jest.spyOn(Date, 'now').mockImplementationOnce(() => Date.UTC(2007, 1, 1));

    wd.promiseChainRemote.mockImplementationOnce((...args) => new BrowserMock(args));

    sauceConnect.mockImplementationOnce((opts, cb) => {
        connectorOptions = opts;

        cb(null , {});
    });

    const sauceConnector = new SauceConnector('user', 'pass', {
        foo: 'bar'
    });

    expect(sauceConnector.options.connectorLogging).toEqual(true);
    expect(sauceConnector.options.createTunnel).toEqual(true);

    await sauceConnector.connect();

    expect(connectorOptions.username).toEqual('user');
    expect(connectorOptions.accessKey).toEqual('pass');
    expect(connectorOptions.tunnelIdentifier).toEqual(Date.UTC(2007, 1, 1));
    expect(connectorOptions.logfile).toEqual(null);
    expect(connectorOptions.directDomains).toEqual('*.google.com,*.gstatic.com,*.googleapis.com');
    expect(connectorOptions.foo).toEqual('bar');

    const browser = await sauceConnector.startBrowser(
        { browserName: 'chrome' },
        'http://example.com',
        { jobName: 'job-name' },
        4242
    );

    expect(browser).toBeInstanceOf(BrowserMock);
    expect(browser.args).toEqual(['ondemand.saucelabs.com', 80, 'user', 'pass']);
    expect(browser.subscribedEvents).toEqual(['status']);
    expect(browser.url).toEqual('http://example.com');
    expect(browser.opts.browserName).toEqual('chrome');
    expect(browser.opts.name).toEqual('job-name');
    expect(browser.opts.tunnelIdentifier).toEqual(Date.UTC(2007, 1, 1));
    expect(browser.opts.idleTimeout).toEqual(1000);
    expect(browser.opts.maxDuration).toEqual(4242);
});

test('Should not create a tunnel if createTunnel is false', async () => {
    let connectorOptions = null;

    jest.spyOn(Date, 'now').mockImplementationOnce(() => Date.UTC(2007, 1, 1));

    sauceConnect.mockImplementationOnce((opts, cb) => {
        connectorOptions = opts;

        cb(null, {});
    });

    wd.promiseChainRemote.mockImplementationOnce((...args) => new BrowserMock(args));

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

    expect(browser.opts).not.toHaveProperty('tunnelIdentifier');

    await sauceConnector.disconnect();
});


test('Should allow using external tunnel', async () => {
    let connectorOptions = null;

    jest.spyOn(Date, 'now').mockImplementationOnce(() => Date.UTC(2007, 1, 1));

    sauceConnect.mockImplementationOnce((opts, cb) => {
        connectorOptions = opts;

        cb(null, {});
    });

    wd.promiseChainRemote.mockImplementationOnce((...args) => new BrowserMock(args));

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

    expect(browser.opts.tunnelIdentifier).toEqual('ABRACADABRA');

    await sauceConnector.disconnect();
});
