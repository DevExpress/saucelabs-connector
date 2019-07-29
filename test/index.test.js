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
    const sauceConnector = new SauceConnector('user', 'pass', {
        tunnelIdentifier: 'tunnel-id',
        foo:              'bar'
    });

    let connectorOptions = null;
    let browser          = null;

    sauceConnect.mockImplementationOnce((opts, cb) => {
        connectorOptions = opts;

        cb(null , {});
    });

    wd.promiseChainRemote.mockImplementationOnce((...args) => new BrowserMock(args));

    await sauceConnector.connect();

    expect(connectorOptions.username).toEqual('user');
    expect(connectorOptions.accessKey).toEqual('pass');
    expect(connectorOptions.tunnelIdentifier).toEqual('tunnel-id');
    expect(connectorOptions.logfile).toEqual(null);
    expect(connectorOptions.directDomains).toEqual('*.google.com,*.gstatic.com,*.googleapis.com');
    expect(connectorOptions.foo).toEqual('bar');

    browser = await sauceConnector.startBrowser(
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
    expect(browser.opts.tunnelIdentifier).toEqual('tunnel-id');
    expect(browser.opts.idleTimeout).toEqual(1000);
    expect(browser.opts.maxDuration).toEqual(4242);
});