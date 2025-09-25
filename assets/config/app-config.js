(function(global){
    const existing = global.CONTROLADA_CONFIG || {};

    const DEFAULT_CONFIG = {
        API_BASE_URL: 'http://localhost:3333',
        STORAGE_PREFIX: 'controlada_'
    };

    global.CONTROLADA_CONFIG = Object.assign({}, DEFAULT_CONFIG, existing);
})(typeof window !== 'undefined' ? window : globalThis);
