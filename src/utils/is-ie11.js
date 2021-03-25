const IE11_NAME          = 'internet explorer';
const IE11_MAJOR_VERSION = 11;

export default function (browser) {
    const version = parseInt(browser.version, 10);

    return browser.browserName.toLowerCase() === IE11_NAME && version === IE11_MAJOR_VERSION;
}
