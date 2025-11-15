(function(global){
    const noopPromise = Promise.resolve();
    const config = global.CONTROLADA_CONFIG || {};
    const API_BASE_URL = typeof config.API_BASE_URL === 'string' ? config.API_BASE_URL.trim() : '';
    const STORAGE_PREFIX = typeof config.STORAGE_PREFIX === 'string' ? config.STORAGE_PREFIX : 'controlada_';
    const TOKEN_STORAGE_KEY = `${STORAGE_PREFIX}auth_token`;
    const USER_STORAGE_KEY = `${STORAGE_PREFIX}auth_user`;

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
        'autenticado'
    ];

    const hasFetch = typeof fetch === 'function';
    const hasApiBase = API_BASE_URL.length > 0;
    const isRemoteAvailable = hasFetch && hasApiBase;

    let lastSyncPromise = null;
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
            storeUser(null);
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

    async function request(path, { method = 'GET', body = undefined, headers = {} } = {}){
        if(!isRemoteAvailable){
            throw new Error('API remota não configurada.');
        }

        const finalHeaders = new Headers(headers);
        let payload = body;

        if(body !== undefined && body !== null && !(body instanceof FormData)){
            finalHeaders.set('Content-Type', 'application/json');
            payload = JSON.stringify(body);
        }

        const token = getStoredToken();
        if(token){
            finalHeaders.set('Authorization', `Bearer ${token}`);
        }

        let response;
        try {
            response = await fetch(`${API_BASE_URL}${path}`, {
                method,
                headers: finalHeaders,
                body: method === 'GET' || method === 'HEAD' ? undefined : payload
            });
        } catch (error) {
            const networkError = new Error('Falha ao se comunicar com a API.');
            networkError.code = 'NETWORK_ERROR';
            networkError.cause = error;
            throw networkError;
        }

        if(response.status === 401){
            clearLocalData();
            notifyAuthListeners(null);
            const unauthorizedError = new Error('Sessão expirada. Faça login novamente.');
            unauthorizedError.code = 'NOT_AUTHENTICATED';
            throw unauthorizedError;
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
            if(!localStorage.getItem('autenticado')){
                localStorage.setItem('autenticado', 'true');
            }
            return noopPromise;
        }

        if(lastSyncPromise && !force){
            return lastSyncPromise;
        }

        lastSyncPromise = (async () => {
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
            localStorage.setItem('autenticado', 'true');
        })().catch(error => {
            console.error('Erro ao sincronizar dados com a API.', error);
            throw error;
        }).finally(() => {
            lastSyncPromise = null;
        });

        return lastSyncPromise;
    }

    async function ensureAuthenticated(){
        if(!isRemoteAvailable){
            if(!localStorage.getItem('autenticado')){
                localStorage.setItem('autenticado', 'true');
            }
            return noopPromise;
        }

        if(getStoredToken()){
            return loadUserDataToLocalCache();
        }

        clearLocalData();
        const error = new Error('NOT_AUTHENTICATED');
        error.code = 'NOT_AUTHENTICATED';
        return Promise.reject(error);
    }

    async function loginWithUsername(username, password){
        if(!isRemoteAvailable){
            localStorage.setItem('autenticado', 'true');
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

        storeToken(response.token);
        storeUser(response.user || null);
        notifyAuthListeners(response.user || null);
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
            storeToken(response.token);
            storeUser(response.user || null);
            notifyAuthListeners(response.user || null);
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
        return request(`/sync/${encodeURIComponent(key)}`, {
            method: 'PUT',
            body: { value }
        });
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
        onAuthStateChanged
    };

    if(typeof module !== 'undefined' && module.exports){
        module.exports = service;
    }

    global.backendService = service;
    // Compatibilidade retroativa enquanto o restante do código é atualizado.
    global.firebaseService = service;
})(typeof window !== 'undefined' ? window : globalThis);
