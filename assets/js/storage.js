(function(global){
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
        },
        remove(key){
            localStorage.removeItem(key);
        }
    };
    if(typeof module !== 'undefined' && module.exports){
        module.exports = StorageUtil;
    }
    global.storageUtil = StorageUtil;
})(typeof window !== 'undefined' ? window : globalThis);
