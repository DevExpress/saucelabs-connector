// Set the api host from the environment, so it is possible to use e.g. the EU datacenter.
// https://wiki.saucelabs.com/display/DOCS/Sauce+Labs+European+Data+Center+Configuration+Information
export const SAUCE_API_HOST = process.env['SAUCE_API_HOST'] || 'saucelabs.com';
