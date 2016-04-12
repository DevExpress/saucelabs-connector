import Promise from 'pinkie';
import request from 'request';
import promisify from 'pify';
import fs from 'fs';


var requestPromised = promisify(request, Promise);
var readFile        = promisify(fs.readFile, Promise);


export default class SauceStorage {
    constructor (user, pass) {
        this.user = user;
        this.pass = pass;
    }

    async _request (params) {
        var result = await requestPromised(params);

        var statusCode = result.statusCode;
        var body       = result.body;

        if (statusCode !== 200) {
            throw [
                'Unexpected response from Sauce Labs.',
                params.method + ' ' + params.url,
                'Response status: ' + statusCode,
                'Body: ' + JSON.stringify(body)
            ].join('\n');
        }

        return body;
    }

    async isFileAvailable (fileName) {
        var params = {
            method:  'GET',
            uri:     `https://saucelabs.com/rest/v1/storage/${this.user}`,
            headers: { 'Content-Type': 'application/json' },
            auth:    { user: this.user, pass: this.pass }
        };

        var body  = await this._request(params);
        var files = JSON.parse(body).files;

        var result = files.filter(file => file.name === fileName);

        return result.length > 0;
    }

    async uploadFile (filePath, fileName) {
        var buffer = await readFile(`${filePath}${fileName}`);

        var params = {
            method:  'POST',
            uri:     `https://saucelabs.com/rest/v1/storage/${this.user}/${fileName}?overwrite=true`,
            headers: { 'Content-Type': 'application/octet-stream' },
            auth:    { user: this.user, pass: this.pass },
            body:    buffer.toString('binary', 0, buffer.length)
        };

        await this._request(params);
    }
}
