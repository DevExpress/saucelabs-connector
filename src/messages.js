export const MESSAGE = {
    noFreeMachines:             'There are no free machines',
    failedToCallSauceApi:       'Sauce Labs API request failed.\n{err}',
    unexpectedSauceApiResponse: 'Unexpected response from Sauce Labs.\n{method} {url}\nResponse status: {statusCode}\nBody: {body}'
};

export function getText (template, parameters) {
    let errorStr = template;

    for (const [parameterName, parameterValue] of Object.entries(parameters))
        errorStr = errorStr.replace(new RegExp(`{${parameterName}}`, 'g'), parameterValue);

    return errorStr;
}
