import got from 'got';
import { promisify } from 'util';
import fs from 'fs';
import { SAUCE_API_HOST } from './sauce-host';
import { MESSAGE, getText } from './messages';


const readFile = promisify(fs.readFile, Promise);


export default class SauceStorage {
    constructor (user, pass) {
        this.user = user;
        this.pass = pass;
    }

    _request (params) {
        return got(params)
            .then(response => {
                if (response.statusCode !== 200) {
                    throw new Error(getText(MESSAGE.unexpectedSauceApiResponse,
                        {
                            method:     params.method,
                            url:        params.url,
                            statusCode: response.statusCode,
                            body:       JSON.stringify(response.body)
                        }));
                }

                return response.body;
            })
            .catch(err => {
                throw new Error(getText(MESSAGE.failedToCallSauceApi, { err }));
            });
    }

    async isFileAvailable (fileName) {
        const params = {
            method:   'GET',
            uri:      `https://${SAUCE_API_HOST}/rest/v1/storage/${this.user}`,
            headers:  { 'Content-Type': 'application/json' },
            username: this.user,
            pass:     this.pass
        };

        const body  = await this._request(params);
        const files = JSON.parse(body).files;

        const result = files.filter(file => file.name === fileName);

        return result.length > 0;
    }

    async uploadFile (filePath, fileName) {
        const buffer = await readFile(`${filePath}${fileName}`);

        const params = {
            method:   'POST',
            uri:      `https://${SAUCE_API_HOST}/rest/v1/storage/${this.user}/${fileName}?overwrite=true`,
            headers:  { 'Content-Type': 'application/octet-stream' },
            username: this.user,
            password: this.pass,
            body:     buffer.toString('binary', 0, buffer.length)
        };

        await this._request(params);
    }
}
