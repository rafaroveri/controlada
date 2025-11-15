(function(global){
    const config = global.CONTROLADA_CONFIG || {};
    const SESSION_HOURS = Number(config.OFFLINE_SESSION_HOURS) > 0
        ? Number(config.OFFLINE_SESSION_HOURS)
        : 12;
    const SESSION_TTL_MS = SESSION_HOURS * 60 * 60 * 1000;
    const AUTH_FLAG_KEY = 'autenticado';
    const AUTH_TIMESTAMP_KEY = 'autenticado_at';

    function safeNow(){
        return Date.now();
    }

    function parseTimestamp(raw){
        const value = Number(raw);
        return Number.isFinite(value) ? value : null;
    }

    function touchTimestamp(){
        try {
            if(localStorage.getItem(AUTH_FLAG_KEY)){
                localStorage.setItem(AUTH_TIMESTAMP_KEY, String(safeNow()));
            }
        } catch (error) {
            console.warn('Não foi possível atualizar o timestamp de autenticação offline.', error);
        }
    }

    function recordAuth(){
        try {
            localStorage.setItem(AUTH_FLAG_KEY, 'true');
            localStorage.setItem(AUTH_TIMESTAMP_KEY, String(safeNow()));
        } catch (error) {
            console.warn('Falha ao registrar autenticação offline.', error);
        }
    }

    function clearAuth(){
        try {
            localStorage.removeItem(AUTH_FLAG_KEY);
            localStorage.removeItem(AUTH_TIMESTAMP_KEY);
        } catch (error) {
            console.warn('Falha ao limpar informações de autenticação offline.', error);
        }
    }

    function hasValidTimestamp(now = safeNow()){
        try {
            const stored = parseTimestamp(localStorage.getItem(AUTH_TIMESTAMP_KEY));
            if(!stored){
                return false;
            }
            return (now - stored) <= SESSION_TTL_MS;
        } catch (error) {
            console.warn('Não foi possível ler o timestamp de autenticação offline.', error);
            return false;
        }
    }

    function isSessionActive(){
        try {
            return !!localStorage.getItem(AUTH_FLAG_KEY);
        } catch (error) {
            console.warn('Falha ao ler flag de autenticação offline.', error);
            return false;
        }
    }

    function ensureFreshSession(options = {}){
        const now = safeNow();
        const stillValid = isSessionActive() && hasValidTimestamp(now);
        if(!stillValid){
            clearAuth();
            if(typeof options.onExpire === 'function'){
                options.onExpire();
            }
            return false;
        }
        touchTimestamp();
        return true;
    }

    function setupWatchdog(options = {}){
        if(typeof window === 'undefined' || typeof document === 'undefined'){
            return () => {};
        }
        const handler = () => ensureFreshSession(options);
        const focusListener = () => handler();
        const visibilityListener = () => {
            if(!document.hidden){
                handler();
            }
        };

        handler();
        window.addEventListener('focus', focusListener);
        document.addEventListener('visibilitychange', visibilityListener);

        return () => {
            window.removeEventListener('focus', focusListener);
            document.removeEventListener('visibilitychange', visibilityListener);
        };
    }

    const api = {
        SESSION_HOURS,
        SESSION_TTL_MS,
        recordAuth,
        clearAuth,
        touchTimestamp,
        ensureFreshSession,
        setupWatchdog
    };

    if(typeof module !== 'undefined' && module.exports){
        module.exports = api;
    }

    global.authWatchdog = api;
})(typeof window !== 'undefined' ? window : globalThis);
