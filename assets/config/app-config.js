(function(global){
    const existing = global.CONTROLADA_CONFIG || {};

    const DEFAULT_CONFIG = {
        API_BASE_URL: 'http://localhost:3333',
        STORAGE_PREFIX: 'controlada_',
        OFFLINE_SESSION_HOURS: 12,
        API_TIMEOUT_MS: 15000
    };

    global.CONTROLADA_CONFIG = Object.assign({}, DEFAULT_CONFIG, existing);
})(typeof window !== 'undefined' ? window : globalThis);
