(function(global){
    const storage = global.storageUtil || (typeof require !== 'undefined' ? require('./storage') : null);

    if(!storage){
        throw new Error('storageUtil é obrigatório para o CategoriaService.');
    }

    function normalizeValor(nome, valorPersonalizado){
        if(valorPersonalizado){
            return valorPersonalizado;
        }
        if(!nome){
            return `categoria-${Date.now()}`;
        }
        return nome
            .toLowerCase()
            .normalize('NFD')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');
    }

    function ensureLists(){
        const personalizadas = storage.getJSON('categorias_usuario', []);
        const removidas = storage.getJSON('categorias_removidas', []);
        if(!Array.isArray(personalizadas)){
            storage.setJSON('categorias_usuario', []);
        }
        if(!Array.isArray(removidas)){
            storage.setJSON('categorias_removidas', []);
        }
    }

    const CategoriaService = {
        getPersonalizadas(){
            ensureLists();
            return storage.getJSON('categorias_usuario', []);
        },
        setPersonalizadas(lista){
            storage.setJSON('categorias_usuario', Array.isArray(lista) ? lista : []);
        },
        getRemovidas(){
            ensureLists();
            return storage.getJSON('categorias_removidas', []);
        },
        setRemovidas(lista){
            storage.setJSON('categorias_removidas', Array.isArray(lista) ? lista : []);
        },
        generateId(){
            return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).substring(2));
        },
        createCategoria({ nome, cor = '#cccccc', valor } = {}){
            const id = this.generateId();
            const finalValor = normalizeValor(nome, valor);
            const categoria = {
                id,
                nome: nome || 'Nova categoria',
                valor: finalValor,
                cor
            };
            const lista = this.getPersonalizadas();
            const atualizada = [...lista, categoria];
            this.setPersonalizadas(atualizada);
            const removidas = this.getRemovidas().filter(removidaId => removidaId !== id);
            this.setRemovidas(removidas);
            return categoria;
        },
        archiveCategoria(id){
            if(!id) return;
            const lista = this.getPersonalizadas().filter(cat => cat.id !== id);
            this.setPersonalizadas(lista);
            const removidas = this.getRemovidas();
            if(!removidas.includes(id)){
                this.setRemovidas([...removidas, id]);
            }
        },
        restoreCategoria(id){
            if(!id) return;
            const removidas = this.getRemovidas().filter(item => item !== id);
            this.setRemovidas(removidas);
        },
        getTodas(){
            const padrao = [
                { id:'alimentacao', nome:'Alimentação', valor:'alimentacao', cor:'#ffb347' },
                { id:'transporte', nome:'Transporte', valor:'transporte', cor:'#6ec6ff' },
                { id:'lazer', nome:'Lazer', valor:'lazer', cor:'#b388ff' },
                { id:'saude', nome:'Saúde', valor:'saude', cor:'#81c784' },
                { id:'outros', nome:'Outros', valor:'outros', cor:'#e0e0e0' }
            ];
            const personalizadas = this.getPersonalizadas();
            const removidas = this.getRemovidas();
            return [...padrao, ...personalizadas].filter(c => !removidas.includes(c.id));
        }
    };
    if(typeof module !== 'undefined' && module.exports){
        module.exports = CategoriaService;
    }
    global.categoriasService = CategoriaService;
})(typeof window !== 'undefined' ? window : globalThis);
