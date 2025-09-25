(function(global){
    let firebaseService = null;
    try {
        firebaseService = global.firebaseService || (typeof require !== 'undefined' ? require('./firebase-service') : null);
    } catch (error) {
        firebaseService = null;
    }

    function persist(key, value){
        if(!firebaseService || typeof firebaseService.persistKey !== 'function'){
            return;
        }
        try {
            const result = firebaseService.persistKey(key, value);
            if(result && typeof result.catch === 'function'){
                result.catch(err => console.error(`Falha ao sincronizar chave ${key} com Firebase`, err));
            }
        } catch (error) {
            console.error(`Erro inesperado ao tentar sincronizar ${key} com Firebase`, error);
        }
    }

    const StorageUtil = {
        getNumber(key){
            const raw = localStorage.getItem(key);
            if(raw === null) return 0;
            const num = parseFloat(raw);
            if(isNaN(num)){
                console.warn(`Valor inválido para ${key}. Limpando.`);
                localStorage.removeItem(key);
                return 0;
            }
            return num;
        },
        setNumber(key, value){
            localStorage.setItem(key, String(value));
            persist(key, Number(value));
        },
        getJSON(key, defaultValue){
            const raw = localStorage.getItem(key);
            if(!raw) return defaultValue;
            try{
                return JSON.parse(raw);
            }catch(e){
                console.warn(`JSON inválido em ${key}. Limpando.`, e);
                localStorage.removeItem(key);
                return defaultValue;
            }
        },
        setJSON(key, value){
            localStorage.setItem(key, JSON.stringify(value));
            persist(key, value);
        },
        remove(key){
            localStorage.removeItem(key);
            persist(key, null);
        }
    };
    if(typeof module !== 'undefined' && module.exports){
        module.exports = StorageUtil;
    }
    global.storageUtil = StorageUtil;
})(typeof window !== 'undefined' ? window : globalThis);
