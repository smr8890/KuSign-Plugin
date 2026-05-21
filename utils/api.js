import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { startService } from '../api/server.js';
import { createRequest } from '../api/util/request.js';
import { Config } from "../components/index.js";
const api_address = Config.getcfg.api_address

const apiEnvPath = fileURLToPath(new URL('../.env', import.meta.url));

function loadApiEnv() {
    if (fs.existsSync(apiEnvPath)) {
        dotenv.config({ path: apiEnvPath, quiet: true });
    }
}


let apiService = null;
let apiServicePromise = null;

function getApiService() {
    return apiService;
}

async function startApiService() {
    loadApiEnv();

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
    loadApiEnv();

    const result = await fetch(api_address + path, {
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