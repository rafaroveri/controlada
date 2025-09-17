(function(global){
    const CategoriaService = {
        getPersonalizadas(){
            return storageUtil.getJSON('categorias_usuario', []);
        },
        setPersonalizadas(lista){
            storageUtil.setJSON('categorias_usuario', lista);
        },
        getRemovidas(){
            return storageUtil.getJSON('categorias_removidas', []);
        },
        setRemovidas(lista){
            storageUtil.setJSON('categorias_removidas', lista);
        },
        generateId(){
            return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).substring(2));
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
