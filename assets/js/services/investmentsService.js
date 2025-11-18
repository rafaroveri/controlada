(function(global, factory){
    if(typeof module !== 'undefined' && module.exports){
        const storageUtil = require('../storage');
        module.exports = factory(storageUtil, typeof global !== 'undefined' ? global : globalThis);
    } else {
        global.investmentsService = factory(global.storageUtil, global);
    }
})(typeof window !== 'undefined' ? window : globalThis, function(storageUtil, runtimeGlobal){
    const STORAGE_KEY = 'investimentos_lista_local';
    const fallbackStorage = (function(){
        try {
            if(runtimeGlobal && runtimeGlobal.localStorage){
                return runtimeGlobal.localStorage;
            }
        } catch (error) {
            return null;
        }
        return null;
    })();

    function readAll(){
        if(storageUtil && typeof storageUtil.getJSON === 'function'){
            return storageUtil.getJSON(STORAGE_KEY, []);
        }
        if(!fallbackStorage){
            return [];
        }
        try {
            const raw = fallbackStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (error) {
            console.warn('Falha ao ler investimentos locais', error);
            return [];
        }
    }

    function persist(list){
        if(storageUtil && typeof storageUtil.setJSON === 'function'){
            storageUtil.setJSON(STORAGE_KEY, list);
            return;
        }
        if(!fallbackStorage){
            return;
        }
        try {
            fallbackStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (error) {
            console.warn('Não foi possível salvar os investimentos localmente', error);
        }
    }

    function normalizeNumber(value){
        const num = typeof value === 'number' ? value : parseFloat(value);
        return Number.isFinite(num) ? num : 0;
    }

    function generateId(){
        return `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function sanitizePayload(payload){
        const normalized = Object.assign({
            nome: '',
            categoria: '',
            valor: 0,
            rentabilidade: 0
        }, payload || {});
        normalized.nome = String(normalized.nome || '').trim() || 'Investimento sem nome';
        normalized.categoria = String(normalized.categoria || '').trim() || 'Não informado';
        normalized.valor = normalizeNumber(normalized.valor);
        normalized.rentabilidade = normalizeNumber(normalized.rentabilidade);
        normalized.id = normalized.id || generateId();
        normalized.ultimoUpdate = Date.now();
        return normalized;
    }

    function list(){
        return readAll();
    }

    function save(payload){
        const dadosAtuais = readAll();
        const registro = sanitizePayload(payload);
        const index = dadosAtuais.findIndex(item => item.id === registro.id);
        if(index >= 0){
            dadosAtuais[index] = Object.assign({}, dadosAtuais[index], registro);
        } else {
            dadosAtuais.push(registro);
        }
        persist(dadosAtuais);
        return dadosAtuais;
    }

    function remove(id){
        if(!id){
            return readAll();
        }
        const atual = readAll();
        const filtrada = atual.filter(item => item.id !== id);
        persist(filtrada);
        return filtrada;
    }

    function getById(id){
        if(!id){
            return null;
        }
        return readAll().find(item => item.id === id) || null;
    }

    return {
        list,
        save,
        remove,
        getById
    };
});
