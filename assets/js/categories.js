(function(global){
    const REMOVIDAS_KEY = 'categorias_removidas';
    const REMOVIDAS_INFO_KEY = 'categorias_arquivadas_info';
    const PERSONALIZADAS_KEY = 'categorias_usuario';

    const categoriasPadrao = [
        { id:'alimentacao', nome:'Alimentação', valor:'alimentacao', cor:'#ffb347' },
        { id:'transporte', nome:'Transporte', valor:'transporte', cor:'#6ec6ff' },
        { id:'lazer', nome:'Lazer', valor:'lazer', cor:'#b388ff' },
        { id:'saude', nome:'Saúde', valor:'saude', cor:'#81c784' },
        { id:'outros', nome:'Outros', valor:'outros', cor:'#e0e0e0' }
    ];

    function getRemovedIds(){
        const lista = storageUtil.getJSON(REMOVIDAS_KEY, []);
        if(Array.isArray(lista)){
            return lista.filter(Boolean);
        }
        return [];
    }

    function setRemovedIds(ids){
        storageUtil.setJSON(REMOVIDAS_KEY, Array.from(new Set((ids || []).filter(Boolean))));
    }

    function getArchivedInfo(){
        const lista = storageUtil.getJSON(REMOVIDAS_INFO_KEY, []);
        if(Array.isArray(lista)){
            return lista.filter(item => item && item.id);
        }
        return [];
    }

    function setArchivedInfo(lista){
        const normalizado = Array.isArray(lista) ? lista.filter(item => item && item.id).map(item => ({
            id: item.id,
            nome: item.nome || '',
            valor: item.valor || '',
            cor: item.cor || '#9acd32'
        })) : [];
        storageUtil.setJSON(REMOVIDAS_INFO_KEY, normalizado);
    }

    function isDefaultCategory(id){
        return categoriasPadrao.some(cat => cat.id === id);
    }

    function readPersonalizadas(){
        try {
            const lista = storageUtil.getJSON(PERSONALIZADAS_KEY, []);
            return Array.isArray(lista) ? lista : [];
        } catch (error) {
            console.error('Erro ao carregar categorias personalizadas.', error);
            return [];
        }
    }

    function writePersonalizadas(lista){
        const payload = Array.isArray(lista) ? lista : [];
        try {
            storageUtil.setJSON(PERSONALIZADAS_KEY, payload);
        } catch (error) {
            console.error('Erro ao salvar categorias personalizadas.', error);
        }
    }

    const CategoriaService = {
        getCatalogoPadrao(){
            return categoriasPadrao.slice();
        },
        getPersonalizadas(){
            return readPersonalizadas();
        },
        setPersonalizadas(lista){
            writePersonalizadas(lista);
        },
        getRemovidas(){
            const ids = getRemovedIds();
            if(ids.length === 0) return [];
            const arquivadas = getArchivedInfo();
            return ids.map(id => {
                const padrao = categoriasPadrao.find(cat => cat.id === id);
                if(padrao){
                    return { ...padrao, origem: 'padrao' };
                }
                const personalizada = arquivadas.find(cat => cat.id === id)
                    || this.getPersonalizadas().find(cat => cat.id === id);
                if(personalizada){
                    return { ...personalizada, origem: 'personalizada' };
                }
                return { id, nome: 'Categoria removida', valor: id, cor: '#bdbdbd', origem: 'desconhecida' };
            });
        },
        setRemovidas(lista){
            const ids = Array.from(new Set((Array.isArray(lista) ? lista : []).map(item => {
                if(typeof item === 'string') return item;
                if(item && item.id) return item.id;
                return null;
            }).filter(Boolean)));
            setRemovedIds(ids);
            const atuais = getArchivedInfo().filter(item => ids.includes(item.id));
            setArchivedInfo(atuais);
        },
        saveArquivada(categoria){
            if(!categoria || !categoria.id){
                return;
            }
            const ids = new Set(getRemovedIds());
            ids.add(categoria.id);
            setRemovedIds(Array.from(ids));
            if(!isDefaultCategory(categoria.id)){
                const arquivadas = getArchivedInfo();
                const payload = {
                    id: categoria.id,
                    nome: categoria.nome,
                    valor: categoria.valor,
                    cor: categoria.cor
                };
                const idx = arquivadas.findIndex(item => item.id === categoria.id);
                if(idx >= 0){
                    arquivadas[idx] = payload;
                } else {
                    arquivadas.push(payload);
                }
                setArchivedInfo(arquivadas);
            }
        },
        restaurarCategoria(categoria){
            if(!categoria || !categoria.id){
                return;
            }
            const ids = getRemovedIds().filter(id => id !== categoria.id);
            setRemovedIds(ids);
            if(categoria.origem === 'personalizada' || !isDefaultCategory(categoria.id)){
                const personalizadas = this.getPersonalizadas();
                if(!personalizadas.some(cat => cat.id === categoria.id)){
                    personalizadas.push({
                        id: categoria.id,
                        nome: categoria.nome,
                        valor: categoria.valor,
                        cor: categoria.cor
                    });
                    this.setPersonalizadas(personalizadas);
                }
            }
            const arquivadas = getArchivedInfo().filter(item => item.id !== categoria.id);
            setArchivedInfo(arquivadas);
        },
        getCategoriaById(id){
            if(!id) return null;
            return categoriasPadrao.find(cat => cat.id === id)
                || this.getPersonalizadas().find(cat => cat.id === id)
                || getArchivedInfo().find(cat => cat.id === id)
                || null;
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
            const removidas = new Set(getRemovedIds());
            const personalizadas = this.getPersonalizadas();
            return [...categoriasPadrao, ...personalizadas].filter(c => !removidas.has(c.id));
        }
    };
    if(typeof module !== 'undefined' && module.exports){
        module.exports = CategoriaService;
    }
    global.categoriasService = CategoriaService;
})(typeof window !== 'undefined' ? window : globalThis);
