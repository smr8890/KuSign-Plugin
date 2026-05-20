import { startService } from '../api/server.js';
import { createRequest } from '../api/util/request.js';

let apiService = null;
let apiServicePromise = null;

function getApiService() {
    return apiService;
}

async function startApiService() {
    if (apiService?.service) {
        return apiService;
    }

    if (apiServicePromise) {
        return apiServicePromise;
    }

    apiServicePromise = startService()
        .then((service) => {
            apiService = service;
            return service;
        })
        .catch((error) => {
            apiServicePromise = null;
            throw error;
        });

    return apiServicePromise;
}

async function stopApiService() {
    const service = apiService || (apiServicePromise ? await apiServicePromise.catch(() => null) : null);

    if (!service?.service) {
        apiService = null;
        apiServicePromise = null;
        return false;
    }

    await new Promise((resolve, reject) => {
        service.service.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });

    apiService = null;
    apiServicePromise = null;
    return true;
}

async function sendRequest(path, method, headers) {
    const result = await fetch("http://127.0.0.1:3000" + path, {
        method: method,
        headers: headers
    }).then(r => r.json())
    // console.log(result)
    return result
}

export {
    sendRequest,
    getApiService,
    startApiService,
    stopApiService,
};