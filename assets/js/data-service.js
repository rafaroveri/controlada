(function(global, factory){
    const storageDependency = global.storageUtil;
    const categoriaDependency = global.categoriasService;
    const constantsDependency = global.appConstants;

    if(typeof module !== 'undefined' && module.exports){
        const resolvedStorage = storageDependency || require('./storage');
        let resolvedCategorias = categoriaDependency;
        try {
            resolvedCategorias = resolvedCategorias || require('./categories');
        } catch (error) {
            resolvedCategorias = resolvedCategorias || null;
        }
        let resolvedConstants = constantsDependency;
        try {
            resolvedConstants = resolvedConstants || require('./constants');
        } catch (error) {
            resolvedConstants = resolvedConstants || null;
        }
        module.exports = factory(resolvedStorage, resolvedCategorias, resolvedConstants);
    } else {
        global.dataService = factory(storageDependency, categoriaDependency, constantsDependency);
    }
})(typeof window !== 'undefined' ? window : globalThis, function(storageUtil, categoriasService, constants){
    if(!storageUtil){
        throw new Error('storageUtil é obrigatório para o dataService.');
    }

    const rendaKey = 'renda_usuario';
    const gastosKey = 'gastos_usuario';
    const metasKey = 'metas_usuario';
    const recorrentesKey = 'gastos_recorrentes';
    const configKey = 'config_inicio_mes';
    const benefitCardsKey = 'beneficios_usuario';
    const benefitConciliationLogKey = 'beneficios_conciliacao_log';
    const rendaAuditKey = 'renda_auditoria';

    const categoriaAPI = categoriasService || {
        getPersonalizadas: () => [],
        setPersonalizadas: () => {},
        getRemovidas: () => [],
        setRemovidas: () => {},
        generateId: () => Date.now().toString(36),
        getTodas: () => []
    };

    const constantsAPI = constants || { DEFAULT_PAYMENT_ICON: '💰' };

    function formatCurrency(value){
        const numero = typeof value === 'number' ? value : parseFloat(value || 0);
        if(Number.isNaN(numero)){
            return (0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function parseDateParts(data){
        if(!data) return null;

        if(typeof data === 'string'){
            const partes = data.split('-');
            if(partes.length < 2) return null;
            const ano = parseInt(partes[0], 10);
            const mes = parseInt(partes[1], 10);
            const dia = partes.length > 2 ? parseInt(partes[2], 10) : 1;
            if(Number.isNaN(ano) || Number.isNaN(mes)) return null;
            return {
                year: ano,
                month: mes,
                day: Number.isNaN(dia) ? 1 : dia
            };
        }

        if(data instanceof Date && !Number.isNaN(data)){
            return {
                year: data.getFullYear(),
                month: data.getMonth() + 1,
                day: data.getDate()
            };
        }

        const parsed = new Date(data);
        if(Number.isNaN(parsed)) return null;
        return {
            year: parsed.getFullYear(),
            month: parsed.getMonth() + 1,
            day: parsed.getDate()
        };
    }

    function getInicioMes(){
        return storageUtil.getNumber(configKey) || 1;
    }

    function setInicioMes(dia){
        storageUtil.setNumber(configKey, dia);
    }

    function formatCycleKey(year, month){
        return `${year}-${String(month).padStart(2, '0')}`;
    }

    function getCycleKeyForDate(data){
        const startDay = getInicioMes();
        const partes = parseDateParts(data);
        if(!partes){
            return { year: NaN, month: NaN };
        }
        let { year, month, day } = partes;
        if(day < startDay){
            month -= 1;
            if(month < 1){
                month = 12;
                year -= 1;
            }
        }
        return { year, month };
    }

    function getCurrentCycleKeyStr(){
        const { year, month } = getCycleKeyForDate(new Date());
        return formatCycleKey(year, month);
    }

    function getCategoriasPersonalizadas(){
        return categoriaAPI.getPersonalizadas();
    }

    function setCategoriasPersonalizadas(lista){
        categoriaAPI.setPersonalizadas(lista);
    }

    function getCategoriasRemovidas(){
        return categoriaAPI.getRemovidas();
    }

    function setCategoriasRemovidas(lista){
        categoriaAPI.setRemovidas(lista);
    }

    function generateCategoriaId(){
        return categoriaAPI.generateId();
    }

    function getTodasCategorias(){
        return categoriaAPI.getTodas();
    }

    function mapCategoriaValorParaId(){
        const mapa = new Map();
        getTodasCategorias().forEach(cat => mapa.set(cat.valor, cat.id));
        return mapa;
    }

    function gerarIdGasto(){
        return `gasto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function getGastos(){
        const lista = storageUtil.getJSON(gastosKey, []);
        const mapaCategoria = mapCategoriaValorParaId();
        let atualizado = false;
        lista.forEach(gasto => {
            if(!gasto.categoriaId && gasto.categoria && mapaCategoria.has(gasto.categoria)){
                gasto.categoriaId = mapaCategoria.get(gasto.categoria);
                atualizado = true;
            }
            if(!gasto.id){
                gasto.id = gerarIdGasto();
                atualizado = true;
            }
        });
        if(atualizado){
            storageUtil.setJSON(gastosKey, lista);
        }
        return lista;
    }

    function setGastos(lista){
        storageUtil.setJSON(gastosKey, lista);
    }

    function getBenefitCards(){
        return storageUtil.getJSON(benefitCardsKey, []);
    }

    function getBenefitById(id){
        if(!id) return null;
        return getBenefitCards().find(card => card.id === id) || null;
    }

    function setBenefitCards(lista){
        storageUtil.setJSON(benefitCardsKey, lista);
    }

    function getTotalBeneficios(){
        return getBenefitCards().reduce((total, card) => {
            const saldo = parseFloat(card && card.saldo !== undefined ? card.saldo : 0);
            return total + (Number.isNaN(saldo) ? 0 : saldo);
        }, 0);
    }

    function getRendaBase(){
        return storageUtil.getNumber(rendaKey);
    }

    function getRenda(){
        return getRendaBase() + getTotalBeneficios();
    }

    function logRendaAuditoria(entry){
        if(!entry) return [];
        const payload = Object.assign({ timestamp: new Date().toISOString() }, entry);
        if(typeof storageUtil.appendToList === 'function'){
            return storageUtil.appendToList(rendaAuditKey, payload);
        }
        const atual = storageUtil.getJSON(rendaAuditKey, []);
        atual.push(payload);
        storageUtil.setJSON(rendaAuditKey, atual);
        return atual;
    }

    function getRendaAuditoria(limit){
        const lista = storageUtil.getJSON(rendaAuditKey, []);
        if(!Array.isArray(lista)){
            return [];
        }
        if(!limit){
            return lista;
        }
        return lista.slice(Math.max(0, lista.length - limit));
    }

    function logBenefitConciliacao(entry){
        if(!entry) return [];
        const payload = Object.assign({ timestamp: new Date().toISOString() }, entry);
        if(typeof storageUtil.appendToList === 'function'){
            return storageUtil.appendToList(benefitConciliationLogKey, payload);
        }
        const atual = storageUtil.getJSON(benefitConciliationLogKey, []);
        atual.push(payload);
        storageUtil.setJSON(benefitConciliationLogKey, atual);
        return atual;
    }

    function getBenefitConciliationLog(){
        const lista = storageUtil.getJSON(benefitConciliationLogKey, []);
        return Array.isArray(lista) ? lista : [];
    }

    function setRendaBase(valor, options = {}){
        const valorAnterior = getRendaBase();
        const novoValor = Number.isNaN(parseFloat(valor)) ? 0 : parseFloat(valor);
        storageUtil.setNumber(rendaKey, novoValor);
        if(valorAnterior !== novoValor){
            logRendaAuditoria({
                tipoAlteracao: 'renda-base',
                valorAnterior,
                valorNovo: novoValor,
                origem: options.origem || 'atualizacao-renda'
            });
        }
    }

    function setRenda(valor){
        setRendaBase(valor);
    }

    function getRendaDetalhada(){
        const beneficios = getBenefitCards();
        const totalBeneficios = getTotalBeneficios();
        const base = getRendaBase();
        return {
            base,
            beneficios,
            totalBeneficios,
            total: base + totalBeneficios
        };
    }

    function addBenefitCard(card, options = {}){
        const lista = getBenefitCards();
        const saldoInicial = Number.isNaN(parseFloat(card && card.saldo)) ? 0 : parseFloat(card.saldo);
        const novoCartao = Object.assign({}, card, { saldo: saldoInicial });
        lista.push(novoCartao);
        setBenefitCards(lista);
        logRendaAuditoria({
            tipoAlteracao: 'beneficio-adicionado',
            valorAnterior: 0,
            valorNovo: saldoInicial,
            beneficioId: novoCartao.id,
            beneficioNome: novoCartao.nome,
            origem: options.origem || 'cadastro-beneficio'
        });
    }

    function updateBenefitCard(id, updates, options = {}){
        const lista = getBenefitCards();
        const index = lista.findIndex(item => item.id === id);
        if(index === -1){
            return null;
        }
        const atual = lista[index];
        const saldoAnterior = parseFloat(atual.saldo || 0) || 0;
        const atualizado = Object.assign({}, atual, updates);
        if(atualizado.saldo !== undefined){
            const parsed = parseFloat(atualizado.saldo);
            atualizado.saldo = Number.isNaN(parsed) ? 0 : parsed;
        }
        lista[index] = atualizado;
        setBenefitCards(lista);
        if(saldoAnterior !== lista[index].saldo){
            logRendaAuditoria({
                tipoAlteracao: 'beneficio-atualizado',
                valorAnterior: saldoAnterior,
                valorNovo: lista[index].saldo,
                beneficioId: id,
                beneficioNome: lista[index].nome,
                origem: options.origem || 'edicao-beneficio'
            });
        }
        return lista[index];
    }

    function removeBenefitCard(id){
        const lista = getBenefitCards();
        const beneficio = lista.find(item => item.id === id);
        const filtrado = lista.filter(item => item.id !== id);
        setBenefitCards(filtrado);
        if(beneficio){
            const saldoAnterior = parseFloat(beneficio.saldo || 0) || 0;
            logRendaAuditoria({
                tipoAlteracao: 'beneficio-removido',
                valorAnterior: saldoAnterior,
                valorNovo: 0,
                beneficioId: beneficio.id,
                beneficioNome: beneficio.nome,
                origem: 'remocao-beneficio'
            });
        }
    }

    function conciliateBenefitWithExpense(benefitId, expenseId, valor, options = {}){
        const lista = getBenefitCards();
        const index = lista.findIndex(item => item.id === benefitId);
        if(index === -1){
            return null;
        }
        const atual = lista[index];
        const saldoAnterior = parseFloat(atual.saldo || 0) || 0;
        const valorConciliavel = Math.max(0, parseFloat(valor || 0));
        if(valorConciliavel <= 0 || saldoAnterior <= 0){
            return { beneficio: atual, valorConciliado: 0 };
        }
        const valorConciliado = Math.min(saldoAnterior, valorConciliavel);
        const novoSaldo = Math.round((saldoAnterior - valorConciliado) * 100) / 100;
        lista[index] = Object.assign({}, atual, { saldo: novoSaldo });
        setBenefitCards(lista);
        const beneficioAtualizado = lista[index];
        logBenefitConciliacao({
            beneficioId: benefitId,
            beneficioNome: beneficioAtualizado.nome,
            gastoId: expenseId || null,
            valorConciliado,
            saldoAnterior,
            saldoAtual: novoSaldo,
            origem: options.origem || 'conciliacao-beneficio'
        });
        logRendaAuditoria({
            tipoAlteracao: 'beneficio-conciliado',
            valorAnterior: saldoAnterior,
            valorNovo: novoSaldo,
            beneficioId: benefitId,
            beneficioNome: beneficioAtualizado.nome,
            origem: options.origem || 'conciliacao-beneficio'
        });
        return { beneficio: beneficioAtualizado, valorConciliado };
    }

    function getMetas(){
        return storageUtil.getJSON(metasKey, {});
    }

    function setMetas(obj){
        storageUtil.setJSON(metasKey, obj);
    }

    function getGastosRecorrentes(){
        return storageUtil.getJSON(recorrentesKey, []);
    }

    function setGastosRecorrentes(lista){
        storageUtil.setJSON(recorrentesKey, lista);
    }

    function getMesesAnosDisponiveis(){
        const lista = getGastos();
        const meses = new Set();
        lista.forEach(gasto => {
            const { year, month } = getCycleKeyForDate(gasto.data);
            if(!Number.isNaN(year) && !Number.isNaN(month)){
                meses.add(formatCycleKey(year, month));
            }
        });
        meses.add(getCurrentCycleKeyStr());
        return Array.from(meses).sort((a, b) => b.localeCompare(a));
    }

    function getGastosDoMesAno(mesAno){
        if(!mesAno || typeof mesAno !== 'string' || !mesAno.includes('-')){
            console.warn('getGastosDoMesAno: mesAno inválido:', mesAno);
            return [];
        }
        const [anoStr, mesStr] = mesAno.split('-');
        const ano = parseInt(anoStr, 10);
        const mes = parseInt(mesStr, 10);
        if(Number.isNaN(ano) || Number.isNaN(mes)){
            console.warn('getGastosDoMesAno: ano ou mês inválido:', anoStr, mesStr);
            return [];
        }
        return getGastos().filter(gasto => {
            const { year, month } = getCycleKeyForDate(gasto.data);
            return year === ano && month === mes;
        });
    }

    function getTotalGastosMes(mesAno){
        if(!mesAno){
            console.warn('getTotalGastosMes: mesAno inválido:', mesAno);
            return 0;
        }
        return getGastosDoMesAno(mesAno).reduce((soma, gasto) => soma + parseFloat(gasto.valor || 0), 0);
    }

    function getTotalGastosMesAtual(){
        const cicloAtual = getCurrentCycleKeyStr();
        return getGastosDoMesAno(cicloAtual).reduce((soma, gasto) => soma + parseFloat(gasto.valor || 0), 0);
    }

    function calcularProgressoMetas(){
        const metas = getMetas();
        const totalMeta = Object.values(metas).reduce((soma, valor) => soma + parseFloat(valor || 0), 0);
        const totalMes = getTotalGastosMes(getCurrentCycleKeyStr());
        const progresso = totalMeta > 0 ? totalMes / totalMeta : 0;
        return { totalMeta, totalMes, progresso };
    }

    function getGastosHoje(){
        const hoje = new Date().toISOString().slice(0, 10);
        const mesAtual = getCurrentCycleKeyStr();
        return getGastosDoMesAno(mesAtual).filter(gasto => gasto.data === hoje);
    }

    function getTotalGastosHoje(){
        return getGastosHoje().reduce((total, gasto) => total + parseFloat(gasto.valor || 0), 0);
    }

    function getQuantidadeGastosHoje(){
        return getGastosHoje().length;
    }

    function getTendenciaGastos(){
        const mesAtual = getCurrentCycleKeyStr();
        const agora = new Date();
        const mesAnteriorData = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
        const cicloAnterior = getCycleKeyForDate(mesAnteriorData);
        const mesAnteriorKey = formatCycleKey(cicloAnterior.year, cicloAnterior.month);

        const totalAtual = getTotalGastosMes(mesAtual);
        const totalAnterior = getTotalGastosMes(mesAnteriorKey);

        if(totalAnterior === 0){
            return totalAtual > 0 ? 'Crescimento' : 'Estável';
        }

        const variacao = ((totalAtual - totalAnterior) / totalAnterior) * 100;

        if(variacao > 10) return 'Alta 📈';
        if(variacao > 0) return 'Crescimento 📊';
        if(variacao < -10) return 'Queda 📉';
        if(variacao < 0) return 'Redução 📊';
        return 'Estável 📊';
    }

    function getComparativoMesAnterior(){
        const mesAtual = getCurrentCycleKeyStr();
        const agora = new Date();
        const mesAnteriorData = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
        const cicloAnterior = getCycleKeyForDate(mesAnteriorData);
        const mesAnteriorKey = formatCycleKey(cicloAnterior.year, cicloAnterior.month);

        const totalAtual = getTotalGastosMes(mesAtual);
        const totalAnterior = getTotalGastosMes(mesAnteriorKey);
        const variacao = totalAnterior === 0 ? 0 : ((totalAtual - totalAnterior) / totalAnterior) * 100;

        return {
            atual: totalAtual,
            anterior: totalAnterior,
            variacao,
            indicador: variacao > 0 ? '📈' : variacao < 0 ? '📉' : '📊'
        };
    }

    function getDistribuicaoMetodosPagamento(mesAno){
        const mesAtual = mesAno || getCurrentCycleKeyStr();
        const gastos = getGastosDoMesAno(mesAtual);
        const distribuicao = {};
        let total = 0;

        gastos.forEach(gasto => {
            const metodo = gasto.metodoPagamento || 'Não informado';
            const valor = parseFloat(gasto.valor || 0);
            distribuicao[metodo] = (distribuicao[metodo] || 0) + valor;
            total += valor;
        });

        const percentuais = {};
        Object.keys(distribuicao).forEach(metodo => {
            percentuais[metodo] = total > 0 ? (distribuicao[metodo] / total) * 100 : 0;
        });

        return { valores: distribuicao, percentuais, total };
    }

    function getMaiorGasto(){
        const mesAtual = getCurrentCycleKeyStr();
        const gastos = getGastosDoMesAno(mesAtual);
        if(gastos.length === 0) return { valor: 0, descricao: '-', categoria: '-' };
        const maior = gastos.reduce((maiorAtual, gasto) => (
            parseFloat(gasto.valor || 0) > parseFloat(maiorAtual.valor || 0) ? gasto : maiorAtual
        ));
        return {
            valor: parseFloat(maior.valor || 0),
            descricao: maior.descricao,
            categoria: maior.categoria
        };
    }

    function getCategoriaDominante(){
        const mesAtual = getCurrentCycleKeyStr();
        const gastos = getGastosDoMesAno(mesAtual);
        if(gastos.length === 0) return { categoria: '-', valor: 0, percentual: 0 };
        const categorias = {};
        let totalGeral = 0;
        gastos.forEach(gasto => {
            const chaveCategoria = gasto.categoria || 'Outros';
            const valor = parseFloat(gasto.valor || 0);
            categorias[chaveCategoria] = (categorias[chaveCategoria] || 0) + valor;
            totalGeral += valor;
        });
        const dominante = Object.keys(categorias).reduce((a, b) => categorias[a] > categorias[b] ? a : b);
        const valorDominante = categorias[dominante];
        const percentual = totalGeral > 0 ? (valorDominante / totalGeral) * 100 : 0;
        return { categoria: dominante, valor: valorDominante, percentual };
    }

    function getProjecaoMensal(){
        const mesAtual = getCurrentCycleKeyStr();
        const gastos = getGastosDoMesAno(mesAtual);
        if(gastos.length === 0) return 0;
        const hoje = new Date();
        const inicioMes = getInicioMes();
        let dataInicioCiclo;
        if(hoje.getDate() >= inicioMes){
            dataInicioCiclo = new Date(hoje.getFullYear(), hoje.getMonth(), inicioMes);
        } else {
            dataInicioCiclo = new Date(hoje.getFullYear(), hoje.getMonth() - 1, inicioMes);
        }
        const dataFimCiclo = new Date(dataInicioCiclo);
        dataFimCiclo.setMonth(dataFimCiclo.getMonth() + 1);
        dataFimCiclo.setDate(dataFimCiclo.getDate() - 1);
        const diasTotais = Math.ceil((dataFimCiclo - dataInicioCiclo) / (1000 * 60 * 60 * 24)) + 1;
        const diasDecorridos = Math.ceil((hoje - dataInicioCiclo) / (1000 * 60 * 60 * 24)) + 1;
        const totalAtual = getTotalGastosMes(mesAtual);
        const mediaDiaria = totalAtual / diasDecorridos;
        return mediaDiaria * diasTotais;
    }

    function getUltimosGastosImportantes(){
        const mesAtual = getCurrentCycleKeyStr();
        const gastos = getGastosDoMesAno(mesAtual);
        if(gastos.length === 0) return [];
        const total = gastos.reduce((soma, gasto) => soma + parseFloat(gasto.valor || 0), 0);
        const media = total / gastos.length;
        return gastos
            .filter(gasto => parseFloat(gasto.valor || 0) > media)
            .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
            .slice(0, 5);
    }

    function findExpensesByCategoryId(id, categoriaValor){
        return getGastos().filter(gasto => {
            if(gasto.categoriaId){
                return gasto.categoriaId === id;
            }
            if(!categoriaValor) return false;
            return gasto.categoria === categoriaValor;
        });
    }

    return {
        formatCurrency,
        getInicioMes,
        setInicioMes,
        getCycleKeyForDate,
        getCurrentCycleKeyStr,
        getCategoriasPersonalizadas,
        setCategoriasPersonalizadas,
        getCategoriasRemovidas,
        setCategoriasRemovidas,
        generateCategoriaId,
        getTodasCategorias,
        getGastos,
        setGastos,
        getBenefitCards,
        getBenefitById,
        setBenefitCards,
        getTotalBeneficios,
        getRendaBase,
        getRenda,
        setRendaBase,
        setRenda,
        getRendaDetalhada,
        addBenefitCard,
        updateBenefitCard,
        removeBenefitCard,
        conciliateBenefitWithExpense,
        getMetas,
        setMetas,
        getGastosRecorrentes,
        setGastosRecorrentes,
        getMesesAnosDisponiveis,
        getGastosDoMesAno,
        getTotalGastosMes,
        getTotalGastosMesAtual,
        calcularProgressoMetas,
        getGastosHoje,
        getTotalGastosHoje,
        getQuantidadeGastosHoje,
        getTendenciaGastos,
        getComparativoMesAnterior,
        getDistribuicaoMetodosPagamento,
        getMaiorGasto,
        getCategoriaDominante,
        getProjecaoMensal,
        getUltimosGastosImportantes,
        findExpensesByCategoryId,
        logRendaAuditoria,
        getRendaAuditoria,
        logBenefitConciliacao,
        getBenefitConciliationLog,
        constants: constantsAPI
    };
});
