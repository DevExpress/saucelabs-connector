export const MESSAGE = {
    noFreeMachines:                        'There are no free machines',
    failedToCallSauceApi:                  'Failed to reach the Sauce Labs API.\n{err}',
    unexpectedSauceApiResponse:            'Unexpected response from Sauce Labs.\n{method} {url}\nResponse status: {statusCode}\nBody: {body}',
    freeMachinesNumberIsLessThanRequested: 'The number of free machines ({freeMachineCount}) is less than requested ({machineCount}).',
    browserStarted:                        '{browser.browserName} started. See {sessionUrl}',
    failedToReadIePrerunBat:               'Failed to read the Internet Explorer 11 pre-run executable ({filePath}{fileName}).\n{err}'
};

export function getText (template, parameters) {
    let errorStr = template;

    for (const [parameterName, parameterValue] of Object.entries(parameters))
        errorStr = errorStr.replace(new RegExp(`{${parameterName}}`, 'g'), parameterValue);

    return errorStr;
}
