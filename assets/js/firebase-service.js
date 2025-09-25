(function(global){
    const hasFirebase = typeof firebase !== 'undefined' && firebase?.apps;
    const noopPromise = Promise.resolve();

    let auth = null;
    let database = null;
    let currentUser = null;
    let lastSyncPromise = null;

    const LOCAL_KEYS = [
        'renda_usuario',
        'gastos_usuario',
        'metas_usuario',
        'gastos_recorrentes',
        'config_inicio_mes',
        'beneficios_usuario',
        'categorias_usuario',
        'categorias_removidas',
        'firebase_uid',
        'perfil_usuario',
        'autenticado'
    ];

    if(hasFirebase){
        auth = firebase.auth();
        database = firebase.database();
        currentUser = auth.currentUser;
        auth.onAuthStateChanged(user => {
            currentUser = user || null;
        });
    }

    function isObject(value){
        return value && typeof value === 'object' && !Array.isArray(value);
    }

    function parseNumber(value, fallback = 0){
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }

    function computeCycleKey(dateInput, startDay){
        if(!dateInput){
            return 'indefinido';
        }
        const start = Number.isFinite(startDay) && startDay >= 1 && startDay <= 31 ? startDay : 1;
        const data = new Date(dateInput);
        if(Number.isNaN(data)){ return 'indefinido'; }
        let year = data.getFullYear();
        let month = data.getMonth() + 1;
        const day = data.getDate();
        if(day < start){
            month -= 1;
            if(month < 1){
                month = 12;
                year -= 1;
            }
        }
        return `${year}-${String(month).padStart(2, '0')}`;
    }

    function clearLocalData(){
        try {
            LOCAL_KEYS.forEach(key => localStorage.removeItem(key));
        } catch (error) {
            console.warn('Não foi possível limpar os dados locais.', error);
        }
    }

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

    async function persistKey(key, value){
        if(!hasFirebase || !currentUser || !database){
            return noopPromise;
        }
        const uid = currentUser.uid;
        const userRef = database.ref(`users/${uid}`);
        try {
            switch(key){
                case 'renda_usuario': {
                    return userRef.child('income/base').set(parseNumber(value));
                }
                case 'beneficios_usuario': {
                    const benefits = {};
                    (Array.isArray(value) ? value : []).forEach(card => {
                        if(!card){ return; }
                        let id = card.id;
                        if(!id){
                            id = database.ref().child('benefitCards').push().key;
                            card.id = id;
                        }
                        benefits[id] = {
                            id,
                            nome: card.nome || '',
                            tipo: card.tipo || 'outro',
                            saldo: parseNumber(card.saldo)
                        };
                    });
                    return userRef.child('income/benefits').set(benefits);
                }
                case 'gastos_usuario': {
                    const startDay = parseNumber(localStorage.getItem('config_inicio_mes'), 1) || 1;
                    const grouped = {};
                    (Array.isArray(value) ? value : []).forEach((expense, index) => {
                        if(!expense){ return; }
                        let id = expense.id;
                        if(!id){
                            id = database.ref().child('expenses').push().key || `exp-${Date.now()}-${index}`;
                            expense.id = id;
                        }
                        const ciclo = computeCycleKey(expense.data, startDay);
                        if(!grouped[ciclo]){
                            grouped[ciclo] = {};
                        }
                        grouped[ciclo][id] = {
                            id,
                            descricao: expense.descricao || '',
                            valor: parseNumber(expense.valor),
                            data: expense.data || '',
                            categoria: expense.categoria || '',
                            categoriaId: expense.categoriaId || null,
                            metodoPagamento: expense.metodoPagamento || ''
                        };
                    });
                    return userRef.child('expenses').set(grouped);
                }
                case 'metas_usuario': {
                    const metas = isObject(value) ? value : {};
                    return userRef.child('goals').set(metas);
                }
                case 'gastos_recorrentes': {
                    const recorrentes = {};
                    (Array.isArray(value) ? value : []).forEach((item, index) => {
                        if(!item){ return; }
                        let id = item.id;
                        if(!id){
                            id = database.ref().child('recurringExpenses').push().key || `rec-${Date.now()}-${index}`;
                            item.id = id;
                        }
                        recorrentes[id] = {
                            id,
                            descricao: item.descricao || '',
                            valor: parseNumber(item.valor),
                            categoria: item.categoria || '',
                            categoriaId: item.categoriaId || null,
                            metodo: item.metodo || item.metodoPagamento || '',
                            frequencia: item.frequencia || 'mensal',
                            proximaData: item.proximaData || '',
                            ativo: item.ativo !== undefined ? !!item.ativo : true,
                            criadoEm: item.criadoEm || new Date().toISOString()
                        };
                    });
                    return userRef.child('recurringExpenses').set(recorrentes);
                }
                case 'config_inicio_mes': {
                    return userRef.child('config/inicioMes').set(parseNumber(value, 1) || 1);
                }
                case 'categorias_usuario': {
                    const categorias = {};
                    (Array.isArray(value) ? value : []).forEach((cat, index) => {
                        if(!cat){ return; }
                        let id = cat.id;
                        if(!id){
                            id = database.ref().child('categories').push().key || `cat-${Date.now()}-${index}`;
                            cat.id = id;
                        }
                        categorias[id] = {
                            id,
                            nome: cat.nome || '',
                            valor: cat.valor || id,
                            cor: cat.cor || '#9acd32'
                        };
                    });
                    return userRef.child('categories/custom').set(categorias);
                }
                case 'categorias_removidas': {
                    const removidas = {};
                    (Array.isArray(value) ? value : []).forEach(id => {
                        if(id){
                            removidas[id] = true;
                        }
                    });
                    return userRef.child('categories/removed').set(removidas);
                }
                default:
                    return noopPromise;
            }
        } catch (error) {
            console.error(`Erro ao persistir chave ${key} no Firebase`, error);
            return Promise.reject(error);
        }
    }

    async function fetchUserData(){
        if(!hasFirebase || !currentUser || !database){
            return {};
        }
        const snapshot = await database.ref(`users/${currentUser.uid}`).get();
        return snapshot.exists() ? snapshot.val() : {};
    }

    function normalizeBenefits(raw){
        if(!raw || typeof raw !== 'object'){ return []; }
        return Object.keys(raw).map(key => ({
            id: key,
            nome: raw[key]?.nome || '',
            tipo: raw[key]?.tipo || 'outro',
            saldo: parseNumber(raw[key]?.saldo)
        }));
    }

    function normalizeCustomCategories(raw){
        if(!raw || typeof raw !== 'object'){ return []; }
        return Object.keys(raw).map(key => ({
            id: key,
            nome: raw[key]?.nome || '',
            valor: raw[key]?.valor || key,
            cor: raw[key]?.cor || '#9acd32'
        }));
    }

    function normalizeRemovedCategories(raw){
        if(!raw || typeof raw !== 'object'){ return []; }
        return Object.keys(raw).filter(key => !!raw[key]);
    }

    function normalizeExpenses(raw){
        const lista = [];
        if(!raw || typeof raw !== 'object'){ return lista; }
        Object.keys(raw).forEach(cycleKey => {
            const expenses = raw[cycleKey];
            if(!expenses || typeof expenses !== 'object'){ return; }
            Object.keys(expenses).forEach(expenseId => {
                const item = expenses[expenseId];
                if(!item){ return; }
                lista.push({
                    id: expenseId,
                    descricao: item.descricao || '',
                    valor: parseNumber(item.valor),
                    data: item.data || '',
                    categoria: item.categoria || '',
                    categoriaId: item.categoriaId || null,
                    metodoPagamento: item.metodoPagamento || ''
                });
            });
        });
        return lista;
    }

    function normalizeRecurring(raw){
        const lista = [];
        if(!raw || typeof raw !== 'object'){ return lista; }
        Object.keys(raw).forEach(key => {
            const item = raw[key];
            if(!item){ return; }
            lista.push({
                id: key,
                descricao: item.descricao || '',
                valor: parseNumber(item.valor),
                categoria: item.categoria || '',
                categoriaId: item.categoriaId || null,
                metodo: item.metodo || item.metodoPagamento || '',
                metodoPagamento: item.metodo || item.metodoPagamento || '',
                frequencia: item.frequencia || 'mensal',
                proximaData: item.proximaData || '',
                ativo: item.ativo !== undefined ? !!item.ativo : true,
                criadoEm: item.criadoEm || ''
            });
        });
        return lista;
    }

    async function loadUserDataToLocalCache(force = false){
        if(!hasFirebase || !currentUser){
            if(!localStorage.getItem('autenticado')){
                localStorage.setItem('autenticado', 'true');
            }
            return noopPromise;
        }
        if(lastSyncPromise && !force){
            return lastSyncPromise;
        }
        lastSyncPromise = (async () => {
            const data = await fetchUserData();
            const config = data.config || {};
            const income = data.income || {};
            const categorias = data.categories || {};
            const profile = data.profile || {};

            localStorage.setItem('config_inicio_mes', String(parseNumber(config.inicioMes, 1) || 1));
            localStorage.setItem('renda_usuario', String(parseNumber(income.base, 0)));
            localStorage.setItem('beneficios_usuario', JSON.stringify(normalizeBenefits(income.benefits)));
            localStorage.setItem('categorias_usuario', JSON.stringify(normalizeCustomCategories(categorias.custom)));
            localStorage.setItem('categorias_removidas', JSON.stringify(normalizeRemovedCategories(categorias.removed)));
            localStorage.setItem('gastos_usuario', JSON.stringify(normalizeExpenses(data.expenses)));
            localStorage.setItem('metas_usuario', JSON.stringify(isObject(data.goals) ? data.goals : {}));
            localStorage.setItem('gastos_recorrentes', JSON.stringify(normalizeRecurring(data.recurringExpenses)));
            localStorage.setItem('firebase_uid', currentUser.uid);
            localStorage.setItem('perfil_usuario', JSON.stringify({
                username: profile.username || '',
                nomeCompleto: profile.fullName || profile.nomeCompleto || '',
                email: profile.email || currentUser.email || '',
                telefone: profile.phone || '',
                temaPreferido: config.temaPreferido || profile.themePreference || 'light'
            }));
            localStorage.setItem('autenticado', 'true');
        })().catch(error => {
            console.error('Erro ao carregar dados do usuário no cache local', error);
            throw error;
        }).finally(() => {
            lastSyncPromise = null;
        });
        return lastSyncPromise;
    }

    async function ensureAuthenticated(){
        if(!hasFirebase){
            if(!localStorage.getItem('autenticado')){
                localStorage.setItem('autenticado', 'true');
            }
            return noopPromise;
        }
        if(currentUser){
            return loadUserDataToLocalCache();
        }
        return new Promise((resolve, reject) => {
            const unsubscribe = auth.onAuthStateChanged(async user => {
                unsubscribe();
                currentUser = user || null;
                if(!user){
                    clearLocalData();
                    reject(new Error('NOT_AUTHENTICATED'));
                    return;
                }
                try {
                    await loadUserDataToLocalCache();
                    resolve(user);
                } catch (error) {
                    reject(error);
                }
            }, error => {
                unsubscribe();
                reject(error);
            });
        });
    }

    async function loginWithUsername(username, password){
        if(!hasFirebase){
            localStorage.setItem('autenticado', 'true');
            return noopPromise;
        }
        if(!username || !password){
            throw new Error('Informe usuário e senha.');
        }
        const snapshot = await database.ref(`usernames/${username}`).get();
        if(!snapshot.exists()){
            throw new Error('Usuário não encontrado.');
        }
        const dados = snapshot.val();
        const email = dados?.email;
        if(!email){
            throw new Error('Credenciais inválidas.');
        }
        const credential = await auth.signInWithEmailAndPassword(email, password);
        currentUser = credential.user;
        await database.ref(`users/${currentUser.uid}/profile`).update({
            lastLoginAt: firebase.database.ServerValue.TIMESTAMP
        });
        await loadUserDataToLocalCache(true);
    }

    async function registerUser(options){
        if(!hasFirebase){
            throw new Error('Firebase não configurado.');
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

        const usernameSnapshot = await database.ref(`usernames/${username}`).get();
        if(usernameSnapshot.exists()){
            throw new Error('Nome de usuário já está em uso.');
        }

        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const { user } = userCredential;
        currentUser = user;

        const uid = user.uid;
        const profile = {
            username,
            email,
            fullName: fullName || '',
            phone: phone || '',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            themePreference: themePreference || 'light'
        };

        const config = {
            inicioMes: parseNumber(inicioMes, 1) || 1,
            temaPreferido: themePreference || 'light'
        };

        const renda = parseNumber(rendaBase, 0);

        await database.ref(`users/${uid}`).set({
            profile,
            config,
            income: {
                base: renda,
                benefits: {}
            },
            categories: {
                custom: {},
                removed: {}
            },
            expenses: {},
            recurringExpenses: {},
            goals: {}
        });

        await database.ref(`usernames/${username}`).set({
            uid,
            email
        });

        await loadUserDataToLocalCache(true);
    }

    async function logout(){
        if(hasFirebase){
            await auth.signOut();
        }
        clearLocalData();
    }

    function onAuthStateChanged(callback){
        if(!hasFirebase || typeof callback !== 'function'){
            return () => {};
        }
        return auth.onAuthStateChanged(callback);
    }

    const service = {
        isFirebaseAvailable: !!hasFirebase,
        getCurrentUser: () => currentUser,
        isAuthenticated: () => !!currentUser || !!localStorage.getItem('autenticado'),
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

    global.firebaseService = service;
})(typeof window !== 'undefined' ? window : globalThis);
