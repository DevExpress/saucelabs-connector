import { Promise } from 'es6-promise';


export default function (ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}
