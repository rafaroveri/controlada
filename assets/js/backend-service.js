(function(global){
    const noopPromise = Promise.resolve();
    const config = global.CONTROLADA_CONFIG || {};
    const API_BASE_URL = typeof config.API_BASE_URL === 'string' ? config.API_BASE_URL.trim() : '';
    const STORAGE_PREFIX = typeof config.STORAGE_PREFIX === 'string' ? config.STORAGE_PREFIX : 'controlada_';
    const TOKEN_STORAGE_KEY = `${STORAGE_PREFIX}auth_token`;
    const REFRESH_TOKEN_STORAGE_KEY = `${STORAGE_PREFIX}auth_refresh_token`;
    const USER_STORAGE_KEY = `${STORAGE_PREFIX}auth_user`;
    const REQUEST_TIMEOUT_MS = Number(config.API_TIMEOUT_MS) > 0 ? Number(config.API_TIMEOUT_MS) : 15000;
    const watchdog = global.authWatchdog || null;

    const LOCAL_KEYS = [
        'renda_usuario',
        'gastos_usuario',
        'metas_usuario',
        'gastos_recorrentes',
        'config_inicio_mes',
        'beneficios_usuario',
        'categorias_usuario',
        'categorias_removidas',
        'categorias_arquivadas_info',
        'perfil_usuario',
        'autenticado',
        'autenticado_at',
        'last_sync_at'
    ];

    const hasFetch = typeof fetch === 'function';
    const hasApiBase = API_BASE_URL.length > 0;
    const isRemoteAvailable = hasFetch && hasApiBase;

    let lastSyncPromise = null;
    let refreshPromise = null;
    const authListeners = new Set();

    function ensureLocalStorage(){
        if(typeof localStorage === 'undefined' && typeof global !== 'undefined'){
            let storage = {};
            global.localStorage = {
                getItem(key){
                    return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
                },
                setItem(key, value){
                    storage[key] = String(value);
                },
                removeItem(key){
                    delete storage[key];
                },
                clear(){
                    storage = {};
                }
            };
        }
    }

    ensureLocalStorage();

    function markOfflineAuthenticated(){
        if(watchdog && typeof watchdog.recordAuth === 'function'){
            watchdog.recordAuth();
            return;
        }
        try {
            localStorage.setItem('autenticado', 'true');
            localStorage.setItem('autenticado_at', String(Date.now()));
        } catch (error) {
            console.warn('Não foi possível atualizar o estado de autenticação offline.', error);
        }
    }

    function clearOfflineAuth(){
        if(watchdog && typeof watchdog.clearAuth === 'function'){
            watchdog.clearAuth();
            return;
        }
        try {
            localStorage.removeItem('autenticado');
            localStorage.removeItem('autenticado_at');
        } catch (error) {
            console.warn('Não foi possível limpar o estado de autenticação offline.', error);
        }
    }

    function updateLastSyncTimestamp(){
        const timestamp = new Date().toISOString();
        try {
            localStorage.setItem('last_sync_at', timestamp);
        } catch (error) {
            console.warn('Não foi possível atualizar o timestamp da última sincronização.', error);
        }
        return timestamp;
    }

    function dispatchSyncEvent(state, detail){
        const target = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : null);
        if(!target || typeof target.dispatchEvent !== 'function'){
            return;
        }
        const payload = Object.assign({ state }, detail);
        let event;
        if(typeof target.CustomEvent === 'function'){
            event = new target.CustomEvent('controlada:sync', { detail: payload });
        } else if(typeof target.Event === 'function'){
            event = new target.Event('controlada:sync');
            event.detail = payload;
        }
        if(event){
            try {
                target.dispatchEvent(event);
            } catch (error) {
                console.warn('Não foi possível emitir evento de sincronização.', error);
            }
        }
    }

    function parseNumber(value, fallback = 0){
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }

    function getStoredToken(){
        try {
            return localStorage.getItem(TOKEN_STORAGE_KEY);
        } catch (error) {
            console.warn('Não foi possível acessar o token armazenado.', error);
            return null;
        }
    }

    function getStoredRefreshToken(){
        try {
            return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
        } catch (error) {
            console.warn('Não foi possível acessar o refresh token armazenado.', error);
            return null;
        }
    }

    function storeToken(token){
        try {
            if(token){
                localStorage.setItem(TOKEN_STORAGE_KEY, token);
            } else {
                localStorage.removeItem(TOKEN_STORAGE_KEY);
            }
        } catch (error) {
            console.warn('Não foi possível atualizar o token de autenticação.', error);
        }
    }

    function storeRefreshToken(token){
        try {
            if(token){
                localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
            } else {
                localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
            }
        } catch (error) {
            console.warn('Não foi possível atualizar o refresh token.', error);
        }
    }

    function getStoredUser(){
        try {
            const raw = localStorage.getItem(USER_STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('Não foi possível ler o usuário armazenado.', error);
            return null;
        }
    }

    function storeUser(user){
        try {
            if(user){
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
            } else {
                localStorage.removeItem(USER_STORAGE_KEY);
            }
        } catch (error) {
            console.warn('Não foi possível atualizar o cache do usuário.', error);
        }
    }

    function clearLocalData(){
        try {
            LOCAL_KEYS.forEach(key => localStorage.removeItem(key));
            storeToken(null);
            storeRefreshToken(null);
            storeUser(null);
            clearOfflineAuth();
        } catch (error) {
            console.warn('Falha ao limpar dados locais.', error);
        }
    }

    function notifyAuthListeners(user){
        authListeners.forEach(listener => {
            try {
                listener(user);
            } catch (error) {
                console.error('Erro no listener de autenticação.', error);
            }
        });
    }

    // Centraliza o armazenamento dos tokens e do usuário retornado pela API para
    // que qualquer fluxo (login, registro ou refresh) reutilize a mesma lógica.
    function persistAuthSession(payload = {}, { notify = true } = {}){
        const { token, refreshToken, user } = payload || {};
        if(typeof token !== 'undefined'){
            storeToken(token || null);
        }
        if(typeof refreshToken !== 'undefined'){
            storeRefreshToken(refreshToken || null);
        }
        if(typeof user !== 'undefined'){
            storeUser(user || null);
            if(notify){
                notifyAuthListeners(user || null);
            }
        }
    }

    // Remove dados locais e gera um erro padronizado usado nos fluxos de expiração.
    function handleUnauthorized(message){
        clearLocalData();
        notifyAuthListeners(null);
        const unauthorizedError = new Error(message || 'Sessão expirada. Faça login novamente.');
        unauthorizedError.code = 'NOT_AUTHENTICATED';
        throw unauthorizedError;
    }

    // Garante que formulários JSON tenham o cabeçalho correto sem duplicar lógica.
    function applyJsonHeaders(headers){
        if(!headers.has('Content-Type')){
            headers.set('Content-Type', 'application/json');
        }
    }

    // Atualiza o access token utilizando o refresh token armazenado. Chamadas
    // concorrentes compartilham a mesma promise para evitar múltiplas requisições.
    async function refreshSessionToken(){
        if(!isRemoteAvailable){
            throw new Error('API remota não configurada.');
        }
        if(refreshPromise){
            return refreshPromise;
        }
        refreshPromise = (async () => {
            const storedRefresh = getStoredRefreshToken();
            if(!storedRefresh){
                const error = new Error('Refresh token indisponível.');
                error.code = 'NOT_AUTHENTICATED';
                throw error;
            }
            const response = await request('/auth/refresh', {
                method: 'POST',
                body: { refreshToken: storedRefresh },
                skipAuth: true,
                retryOnUnauthorized: false
            });
            if(!response || !response.token){
                throw new Error('Resposta de refresh inválida da API.');
            }
            persistAuthSession(response);
            return response.token;
        })().finally(() => {
            refreshPromise = null;
        });
        return refreshPromise;
    }

    // Função utilitária que aplica o token, executa a chamada HTTP e tenta um
    // refresh automático em caso de expiração (401) antes de invalidar a sessão.
    async function request(path, { method = 'GET', body = undefined, headers = {}, skipAuth = false, retryOnUnauthorized = true } = {}){
        if(!isRemoteAvailable){
            throw new Error('API remota não configurada.');
        }

        const finalHeaders = new Headers(headers);
        let payload = body;

        if(body !== undefined && body !== null && !(body instanceof FormData)){
            applyJsonHeaders(finalHeaders);
            payload = JSON.stringify(body);
        }

        if(!skipAuth){
            const token = getStoredToken();
            if(token){
                finalHeaders.set('Authorization', `Bearer ${token}`);
            }
        }

        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        let timeoutId = null;

        if(controller && REQUEST_TIMEOUT_MS){
            timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        }

        let response;
        try {
            response = await fetch(`${API_BASE_URL}${path}`, {
                method,
                headers: finalHeaders,
                body: method === 'GET' || method === 'HEAD' ? undefined : payload,
                signal: controller ? controller.signal : undefined
            });
        } catch (error) {
            if(timeoutId){
                clearTimeout(timeoutId);
            }
            if(error && error.name === 'AbortError'){
                const timeoutError = new Error('Tempo limite ao se comunicar com a API.');
                timeoutError.code = 'NETWORK_TIMEOUT';
                timeoutError.cause = error;
                throw timeoutError;
            }
            const networkError = new Error('Falha ao se comunicar com a API.');
            networkError.code = 'NETWORK_ERROR';
            networkError.cause = error;
            throw networkError;
        } finally {
            if(timeoutId){
                clearTimeout(timeoutId);
            }
        }

        if(response.status === 401){
            if(!skipAuth && retryOnUnauthorized){
                try {
                    await refreshSessionToken();
                } catch (refreshError) {
                    if(refreshError?.code === 'NOT_AUTHENTICATED' || refreshError?.status === 401 || refreshError?.status === 400){
                        handleUnauthorized(refreshError.message);
                    }
                    throw refreshError;
                }
                return request(path, { method, body, headers, skipAuth, retryOnUnauthorized: false });
            }
            handleUnauthorized();
        }

        const contentType = response.headers.get('content-type') || '';
        let parsed = null;

        if(response.status !== 204){
            if(contentType.includes('application/json')){
                parsed = await response.json().catch(() => null);
            } else {
                parsed = await response.text();
            }
        }

        if(!response.ok){
            const message = (parsed && parsed.message) || (typeof parsed === 'string' && parsed) || `Erro ${response.status} ao se comunicar com a API.`;
            const error = new Error(message);
            error.status = response.status;
            error.code = (parsed && parsed.code) || response.status;
            error.details = parsed;
            throw error;
        }

        return parsed;
    }

    function normalizeBenefits(raw){
        if(!Array.isArray(raw)){
            return [];
        }
        return raw.map(item => ({
            id: item?.id || item?.externalId || `benefit-${Math.random().toString(36).slice(2)}`,
            nome: item?.nome || item?.name || '',
            tipo: item?.tipo || item?.type || 'outro',
            saldo: parseNumber(item?.saldo ?? item?.balance, 0)
        }));
    }

    function normalizeCategories(raw){
        if(!Array.isArray(raw)){
            return [];
        }
        return raw.map(item => ({
            id: item?.id || item?.externalId || `cat-${Math.random().toString(36).slice(2)}`,
            nome: item?.nome || item?.name || '',
            valor: item?.valor || item?.slug || item?.nome || item?.name || '',
            cor: item?.cor || item?.color || '#9acd32'
        }));
    }

    function normalizeRemovedCategories(raw){
        if(Array.isArray(raw)){
            return raw.map(value => (typeof value === 'string' ? value : value?.id)).filter(Boolean);
        }
        if(raw && typeof raw === 'object'){
            return Object.keys(raw).filter(key => !!raw[key]);
        }
        return [];
    }

    function normalizeExpenses(raw){
        if(!Array.isArray(raw)){
            return [];
        }
        return raw.map(item => ({
            id: item?.id || item?.externalId || `exp-${Math.random().toString(36).slice(2)}`,
            descricao: item?.descricao || item?.description || '',
            valor: parseNumber(item?.valor ?? item?.amount, 0),
            data: item?.data || item?.date || '',
            categoria: item?.categoria || item?.categoriaNome || item?.categoryName || '',
            categoriaId: item?.categoriaId || item?.categoryId || null,
            metodoPagamento: item?.metodoPagamento || item?.paymentMethod || ''
        }));
    }

    function normalizeRecurring(raw){
        if(!Array.isArray(raw)){
            return [];
        }
        return raw.map(item => ({
            id: item?.id || item?.externalId || `rec-${Math.random().toString(36).slice(2)}`,
            descricao: item?.descricao || item?.description || '',
            valor: parseNumber(item?.valor ?? item?.amount, 0),
            categoria: item?.categoria || item?.categoriaNome || item?.categoryName || '',
            categoriaId: item?.categoriaId || item?.categoryId || null,
            metodo: item?.metodo || item?.metodoPagamento || item?.paymentMethod || '',
            metodoPagamento: item?.metodoPagamento || item?.paymentMethod || '',
            frequencia: item?.frequencia || item?.frequency || 'mensal',
            proximaData: item?.proximaData || item?.nextOccurrence || '',
            ativo: item?.ativo !== undefined ? !!item?.ativo : item?.active !== undefined ? !!item?.active : true,
            criadoEm: item?.criadoEm || item?.createdAt || ''
        }));
    }

    async function fetchUserSnapshot(){
        if(!isRemoteAvailable){
            return {};
        }
        const snapshot = await request('/sync/snapshot', { method: 'GET' });
        return snapshot || {};
    }

    async function loadUserDataToLocalCache(force = false){
        if(!isRemoteAvailable || !getStoredToken()){
            markOfflineAuthenticated();
            return noopPromise;
        }

        if(lastSyncPromise && !force){
            return lastSyncPromise;
        }

        lastSyncPromise = (async () => {
            dispatchSyncEvent('start', { action: 'snapshot' });
            const snapshot = await fetchUserSnapshot();
            const settings = snapshot.settings || snapshot.config || {};
            const income = snapshot.income || {};
            const categories = snapshot.categories || {};
            const removedCategories = snapshot.removedCategories || snapshot.categoriesRemovidas || [];
            const expenses = snapshot.expenses || [];
            const recurring = snapshot.recurringExpenses || [];
            const goals = snapshot.goals || {};
            const profile = snapshot.profile || snapshot.usuario || {};

            localStorage.setItem('config_inicio_mes', String(parseNumber(settings.cycleStartDay ?? settings.inicioMes, 1) || 1));
            localStorage.setItem('renda_usuario', String(parseNumber(income.baseIncome ?? income.base, 0)));
            localStorage.setItem('beneficios_usuario', JSON.stringify(normalizeBenefits(income.benefits || income.beneficios)));
            localStorage.setItem('categorias_usuario', JSON.stringify(normalizeCategories(categories.custom || categories.personalizadas || [])));
            localStorage.setItem('categorias_removidas', JSON.stringify(normalizeRemovedCategories(removedCategories)));
            localStorage.setItem('gastos_usuario', JSON.stringify(normalizeExpenses(expenses)));
            localStorage.setItem('metas_usuario', JSON.stringify(goals && typeof goals === 'object' ? goals : {}));
            localStorage.setItem('gastos_recorrentes', JSON.stringify(normalizeRecurring(recurring)));
            localStorage.setItem('perfil_usuario', JSON.stringify({
                username: profile.username || profile.nomeUsuario || '',
                nomeCompleto: profile.fullName || profile.nomeCompleto || '',
                email: profile.email || '',
                telefone: profile.phone || profile.telefone || '',
                temaPreferido: settings.themePreference || settings.temaPreferido || 'light'
            }));
            markOfflineAuthenticated();
            const timestamp = updateLastSyncTimestamp();
            dispatchSyncEvent('success', { action: 'snapshot', timestamp });
        })().catch(error => {
            console.error('Erro ao sincronizar dados com a API.', error);
            dispatchSyncEvent('error', { action: 'snapshot', message: error?.message || 'Erro ao sincronizar' });
            throw error;
        }).finally(() => {
            lastSyncPromise = null;
        });

        return lastSyncPromise;
    }

    async function ensureAuthenticated(){
        if(!isRemoteAvailable){
            markOfflineAuthenticated();
            return noopPromise;
        }

        if(getStoredToken()){
            return loadUserDataToLocalCache();
        }

        const hasOfflineSession = watchdog && typeof watchdog.ensureFreshSession === 'function'
            ? watchdog.ensureFreshSession()
            : !!(typeof localStorage !== 'undefined' && localStorage.getItem('autenticado'));

        if(hasOfflineSession){
            markOfflineAuthenticated();
            return noopPromise;
        }

        clearLocalData();
        const error = new Error('NOT_AUTHENTICATED');
        error.code = 'NOT_AUTHENTICATED';
        return Promise.reject(error);
    }

    async function loginWithUsername(username, password){
        if(!isRemoteAvailable){
            markOfflineAuthenticated();
            return noopPromise;
        }

        if(!username || !password){
            throw new Error('Informe usuário e senha.');
        }

        const response = await request('/auth/login', {
            method: 'POST',
            body: { username, password }
        });

        if(!response || !response.token){
            throw new Error('Resposta de login inválida da API.');
        }

        persistAuthSession(response);
        await loadUserDataToLocalCache(true);
    }

    async function registerUser(options){
        if(!isRemoteAvailable){
            throw new Error('API remota não configurada para cadastro.');
        }

        const {
            username,
            password,
            email,
            fullName,
            phone,
            rendaBase,
            inicioMes,
            themePreference
        } = options || {};

        if(!username){
            throw new Error('Informe um nome de usuário.');
        }
        if(!email){
            throw new Error('Informe um e-mail.');
        }
        if(!password || password.length < 6){
            throw new Error('A senha deve ter pelo menos 6 caracteres.');
        }

        const response = await request('/auth/register', {
            method: 'POST',
            body: {
                username,
                password,
                email,
                fullName,
                phone,
                baseIncome: parseNumber(rendaBase, 0),
                cycleStartDay: parseNumber(inicioMes, 1) || 1,
                themePreference: themePreference || 'light'
            }
        });

        if(response?.token){
            persistAuthSession(response);
            await loadUserDataToLocalCache(true);
        }
    }

    async function logout(){
        if(isRemoteAvailable && getStoredToken()){
            try {
                await request('/auth/logout', { method: 'POST' });
            } catch (error) {
                if(error.code !== 'NOT_AUTHENTICATED' && error.status !== 401){
                    console.warn('Falha ao finalizar sessão na API.', error);
                }
            }
        }
        clearLocalData();
        notifyAuthListeners(null);
    }

    function onAuthStateChanged(callback){
        if(typeof callback !== 'function'){
            return () => {};
        }
        authListeners.add(callback);
        try {
            callback(getStoredUser());
        } catch (error) {
            console.error('Erro ao notificar listener imediatamente.', error);
        }
        return () => authListeners.delete(callback);
    }

    async function persistKey(key, value){
        if(!isRemoteAvailable || !getStoredToken()){
            return noopPromise;
        }
        dispatchSyncEvent('start', { action: 'persist', key });
        return request(`/sync/${encodeURIComponent(key)}`, {
            method: 'PUT',
            body: { value }
        }).then(result => {
            const timestamp = updateLastSyncTimestamp();
            dispatchSyncEvent('success', { action: 'persist', key, timestamp });
            return result;
        }).catch(error => {
            dispatchSyncEvent('error', { action: 'persist', key, message: error?.message || 'Erro ao sincronizar chave' });
            throw error;
        });
    }

    async function sendWeeklyEmailReport(){
        if(!isRemoteAvailable){
            throw new Error('API remota não configurada.');
        }
        if(!getStoredToken()){
            const error = new Error('Sessão expirada. Faça login novamente.');
            error.code = 'NOT_AUTHENTICATED';
            throw error;
        }
        return request('/reports/weekly-email', { method: 'POST' });
    }

    const service = {
        isRemoteAvailable: !!isRemoteAvailable,
        isFirebaseAvailable: !!isRemoteAvailable,
        getCurrentUser: () => getStoredUser(),
        isAuthenticated: () => !!getStoredToken() || !!localStorage.getItem('autenticado'),
        ensureAuthenticated,
        loginWithUsername,
        registerUser,
        logout,
        loadUserDataToLocalCache,
        persistKey,
        onAuthStateChanged,
        sendWeeklyEmailReport
    };

    if(typeof module !== 'undefined' && module.exports){
        module.exports = service;
    }

    global.backendService = service;
    // Compatibilidade retroativa enquanto o restante do código é atualizado.
    global.firebaseService = service;
})(typeof window !== 'undefined' ? window : globalThis);
