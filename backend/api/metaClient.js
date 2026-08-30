import request from "request";

const META_API_VERSION = process.env.META_API_VERSION || "v23.0";
const META_BASE_URL = (process.env.META_BASE_URL || "https://graph.facebook.com").replace(/\/+$/, "");

const buildMetaUrl = (endPoints = '') => {
    const path = String(endPoints).replace(/^\/+/, "");
    const hasVersion = /^v\d+\.\d+(?:\/|$)/.test(path) || /\/v\d+\.\d+(?:\/|$)/.test(META_BASE_URL);
    return `${hasVersion ? META_BASE_URL : `${META_BASE_URL}/${META_API_VERSION}`}/${path}`;
};

const metaClient = async ({ endPoints = '', method = 'GET', queryStrings = {}, payloads = {}, formData = {} }) => {
    return new Promise((resolve, reject) => {
        request({
            uri: buildMetaUrl(endPoints),
            method,
            timeout: Number(process.env.META_API_TIMEOUT_MS || 15000),
            ...(Object.keys(queryStrings).length > 0 && { qs: queryStrings }),
            ...(Object.keys(payloads).length > 0 && { json: payloads }),
            ...(Object.keys(formData).length > 0 && { formData })
        }, (err, response, body) => {
            if (err) {
                reject(err);
                return;
            }
            if (response.statusCode >= 400) {
                const error = new Error(`Meta Graph API request failed with status ${response.statusCode}`);
                error.statusCode = response.statusCode;
                error.responseBody = body;
                reject(error);
                return;
            }
            resolve(body);
        });
    });
};

export default metaClient;
