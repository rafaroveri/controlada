// ui.js - lógica principal de interface
(function(window, factory){
    if(typeof module !== 'undefined' && module.exports){
        const dataService = require('./data-service');
        const chartsManager = require('./charts');
        const constants = require('./constants');
        module.exports = factory(window, dataService, chartsManager, constants);
    } else {
        window.uiManager = factory(window, window.dataService, window.chartsManager, window.appConstants);
    }
})(typeof window !== 'undefined' ? window : globalThis, function(window, dataService, chartsManager, constants){
    const document = window.document;
    if(!document){
        return { init: function(){} };
    }
    const paymentIcons = (constants && constants.PAYMENT_METHOD_ICONS) || {
        'Dinheiro': '💵',
        'PIX': '📱',
        'Débito': '💳',
        'Crédito': '💳',
        'Cartão': '💳',
        'Outro': '💰'
    };
    const defaultPaymentIcon = (constants && constants.DEFAULT_PAYMENT_ICON) || '💰';
    const benefitTypeIcons = {
        alimentacao: '🍽️',
        refeicao: '🍔',
        transporte: '🚌',
        combustivel: '⛽',
        saude: '🩺',
        cultura: '🎭',
        outro: '🎁'
    };
    const benefitTypeLabels = {
        alimentacao: 'Vale Alimentação',
        refeicao: 'Vale Refeição',
        transporte: 'Vale Transporte',
        combustivel: 'Vale Combustível',
        saude: 'Benefício Saúde',
        cultura: 'Vale Cultura',
        outro: 'Outro benefício'
    };
    function getBenefitIcon(tipo){
        return benefitTypeIcons[tipo] || benefitTypeIcons.outro;
    }
    function getBenefitLabel(tipo){
        return benefitTypeLabels[tipo] || benefitTypeLabels.outro;
    }
    const basePaymentMethods = [
        { value: 'Dinheiro', label: '💵 Dinheiro', icon: '💵' },
        { value: 'PIX', label: '📱 PIX', icon: '📱' },
        { value: 'Débito', label: '💳 Débito', icon: '💳' },
        { value: 'Crédito', label: '💳 Crédito', icon: '💳' }
    ];
    const outroPaymentMethod = { value: 'Outro', label: '✨ Outro', icon: '✨' };
    const formatCurrency = dataService ? dataService.formatCurrency : (valor => {
        const numero = typeof valor === 'number' ? valor : parseFloat(valor || 0);
        return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    });
    function init(){

    // MODO DESENVOLVIMENTO - Simula autenticação se estiver testando localmente
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost && !localStorage.getItem('autenticado')) {
        localStorage.setItem('autenticado', 'true');
    }
    
    // Verifica autenticação - se não está autenticado, redireciona para login
    if (!localStorage.getItem('autenticado')) {
        window.location.href = 'login.html';
        return;
    }

    // --- Renda e sobra ---
    
    // Verificar se elementos existem antes de tentar acessá-los
    const rendaValor = document.getElementById('sidebar-renda-valor');
    const sidebarBeneficiosValor = document.getElementById('sidebar-beneficios-valor');
    const sobraValor = document.getElementById('sidebar-sobra-valor');
    const editarRendaBtn = document.getElementById('editar-renda-btn');
    const menuToggleBtn = document.getElementById('menu-toggle');
    const themeToggleBtn = document.getElementById('theme-toggle');

    // Modal elementos - verificação segura
    const modal = document.getElementById('modal-editar-renda');
    const modalClose = document.getElementById('modal-editar-renda-close');
    const modalCancelar = document.getElementById('modal-editar-renda-cancelar');
    const formModalRenda = document.getElementById('form-modal-renda');
    const inputModalRenda = document.getElementById('input-modal-renda');
    const beneficiosTotalResumo = document.getElementById('beneficios-total-resumo');
    const formBeneficio = document.getElementById('form-beneficio');
    const inputBeneficioNome = document.getElementById('beneficio-nome');
    const selectBeneficioTipo = document.getElementById('beneficio-tipo');
    const inputBeneficioSaldo = document.getElementById('beneficio-saldo');
    const listaBeneficios = document.getElementById('lista-beneficios');
    const selectMetodo = document.getElementById('metodo-pagamento');
    const searchHistorico = document.getElementById('search-historico');
    const filterCategoriaHistorico = document.getElementById('filter-categoria-historico');
    const filterMetodoHistorico = document.getElementById('filter-metodo-historico');

    function resolverCategoriaId(categoriaValor, categoriaIdExistente){
        if(categoriaIdExistente) return categoriaIdExistente;
        const categoriaEncontrada = dataService.getTodasCategorias().find(cat => cat.valor === categoriaValor);
        return categoriaEncontrada ? categoriaEncontrada.id : null;
    }

    function obterRendaDetalhada(){
        if(dataService && typeof dataService.getRendaDetalhada === 'function'){
            return dataService.getRendaDetalhada();
        }
        const rendaAtual = dataService && typeof dataService.getRenda === 'function' ? dataService.getRenda() : 0;
        return {
            base: rendaAtual,
            beneficios: [],
            totalBeneficios: 0,
            total: rendaAtual
        };
    }

    function getBenefitCards(){
        if(dataService && typeof dataService.getBenefitCards === 'function'){
            return dataService.getBenefitCards();
        }
        return [];
    }

    function calcularTotalBeneficios(lista){
        return (lista || []).reduce((total, item) => {
            const saldo = parseFloat(item && item.saldo !== undefined ? item.saldo : 0);
            return total + (Number.isNaN(saldo) ? 0 : saldo);
        }, 0);
    }

    function atualizarResumoBeneficios(detalhes){
        const info = detalhes || obterRendaDetalhada();
        const totalBeneficios = info.totalBeneficios !== undefined
            ? info.totalBeneficios
            : calcularTotalBeneficios(info.beneficios);
        if(sidebarBeneficiosValor){
            sidebarBeneficiosValor.textContent = formatCurrency(totalBeneficios);
        }
        if(beneficiosTotalResumo){
            beneficiosTotalResumo.textContent = `Total em benefícios: ${formatCurrency(totalBeneficios)}`;
        }
        return totalBeneficios;
    }

    function renderBenefitCardsList(detalhes){
        if(!listaBeneficios) return;
        const info = detalhes || obterRendaDetalhada();
        const beneficios = Array.isArray(info.beneficios) ? info.beneficios : [];
        listaBeneficios.innerHTML = '';
        if(beneficios.length === 0){
            const empty = document.createElement('li');
            empty.className = 'beneficio-empty';
            empty.textContent = 'Nenhum cartão de benefício cadastrado ainda.';
            listaBeneficios.appendChild(empty);
            atualizarResumoBeneficios(info);
            return;
        }

        beneficios.forEach(beneficio => {
            const icon = getBenefitIcon(beneficio.tipo);
            paymentIcons[beneficio.nome] = icon;
            const li = document.createElement('li');
            li.className = 'beneficio-item';
            li.dataset.id = beneficio.id;

            const infoDiv = document.createElement('div');
            infoDiv.className = 'beneficio-info';

            const iconSpan = document.createElement('span');
            iconSpan.className = 'beneficio-icone';
            iconSpan.textContent = icon;

            const textoDiv = document.createElement('div');
            textoDiv.className = 'beneficio-texto';

            const nomeStrong = document.createElement('strong');
            nomeStrong.textContent = beneficio.nome;

            const tipoSmall = document.createElement('small');
            tipoSmall.textContent = getBenefitLabel(beneficio.tipo);

            textoDiv.appendChild(nomeStrong);
            textoDiv.appendChild(tipoSmall);

            infoDiv.appendChild(iconSpan);
            infoDiv.appendChild(textoDiv);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'beneficio-actions';

            const saldoSpan = document.createElement('span');
            saldoSpan.className = 'beneficio-saldo';
            const saldoNumerico = parseFloat(beneficio.saldo || 0);
            saldoSpan.textContent = formatCurrency(Number.isNaN(saldoNumerico) ? 0 : saldoNumerico);

            const editarBtn = document.createElement('button');
            editarBtn.type = 'button';
            editarBtn.className = 'beneficio-btn editar';
            editarBtn.dataset.acao = 'editar';
            editarBtn.dataset.id = beneficio.id;
            editarBtn.title = `Atualizar saldo de ${beneficio.nome}`;
            editarBtn.textContent = '✏️';

            const removerBtn = document.createElement('button');
            removerBtn.type = 'button';
            removerBtn.className = 'beneficio-btn remover';
            removerBtn.dataset.acao = 'remover';
            removerBtn.dataset.id = beneficio.id;
            removerBtn.title = `Remover ${beneficio.nome}`;
            removerBtn.textContent = '🗑️';

            actionsDiv.appendChild(saldoSpan);
            actionsDiv.appendChild(editarBtn);
            actionsDiv.appendChild(removerBtn);

            li.appendChild(infoDiv);
            li.appendChild(actionsDiv);
            listaBeneficios.appendChild(li);
        });

        atualizarResumoBeneficios(info);
    }

    function atualizarSeletoresMetodos(){
        const beneficios = getBenefitCards();
        beneficios.forEach(beneficio => {
            paymentIcons[beneficio.nome] = getBenefitIcon(beneficio.tipo);
        });

        if(selectMetodo){
            const valorAtual = selectMetodo.value;
            const divOutro = document.getElementById('div-outro-metodo');
            selectMetodo.innerHTML = '';

            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Selecione o método';
            selectMetodo.appendChild(defaultOption);

            basePaymentMethods.forEach(methodo => {
                const option = document.createElement('option');
                option.value = methodo.value;
                option.textContent = methodo.label;
                selectMetodo.appendChild(option);
            });

            beneficios.forEach(beneficio => {
                const option = document.createElement('option');
                option.value = beneficio.nome;
                option.textContent = `${getBenefitIcon(beneficio.tipo)} ${beneficio.nome}`;
                selectMetodo.appendChild(option);
            });

            const outroOption = document.createElement('option');
            outroOption.value = outroPaymentMethod.value;
            outroOption.textContent = `${outroPaymentMethod.icon} Outro`;
            selectMetodo.appendChild(outroOption);

            const valoresDisponiveis = Array.from(selectMetodo.options).map(opt => opt.value);
            if(valorAtual && valoresDisponiveis.includes(valorAtual)){
                selectMetodo.value = valorAtual;
            } else {
                selectMetodo.value = '';
            }

            if(divOutro){
                divOutro.style.display = selectMetodo.value === 'Outro' ? 'block' : 'none';
            }
        }

        if(filterMetodoHistorico){
            const valorFiltroAtual = filterMetodoHistorico.value;
            filterMetodoHistorico.innerHTML = '';
            const todosOption = document.createElement('option');
            todosOption.value = '';
            todosOption.textContent = '💳 Todos os métodos';
            filterMetodoHistorico.appendChild(todosOption);

            basePaymentMethods.forEach(methodo => {
                const option = document.createElement('option');
                option.value = methodo.value;
                option.textContent = methodo.label;
                filterMetodoHistorico.appendChild(option);
            });

            beneficios.forEach(beneficio => {
                const option = document.createElement('option');
                option.value = beneficio.nome;
                option.textContent = `${getBenefitIcon(beneficio.tipo)} ${beneficio.nome}`;
                filterMetodoHistorico.appendChild(option);
            });

            const outroFiltroOption = document.createElement('option');
            outroFiltroOption.value = outroPaymentMethod.value;
            outroFiltroOption.textContent = `${outroPaymentMethod.icon} Outro`;
            filterMetodoHistorico.appendChild(outroFiltroOption);

            const mesAnoAtual = getMesAnoSelecionado();
            const gastosMes = dataService.getGastosDoMesAno(mesAnoAtual) || [];
            const valoresExistentes = new Set([...basePaymentMethods.map(m => m.value), ...beneficios.map(b => b.nome), outroPaymentMethod.value]);
            gastosMes.forEach(gasto => {
                const metodo = gasto.metodoPagamento;
                if(!metodo || valoresExistentes.has(metodo)) return;
                valoresExistentes.add(metodo);
                const option = document.createElement('option');
                const icon = paymentIcons[metodo] || defaultPaymentIcon;
                option.value = metodo;
                option.textContent = `${icon} ${metodo}`;
                filterMetodoHistorico.appendChild(option);
            });

            if(Array.from(filterMetodoHistorico.options).some(opt => opt.value === valorFiltroAtual)){
                filterMetodoHistorico.value = valorFiltroAtual;
            }
        }

        if(typeof aplicarFiltros === 'function'){
            aplicarFiltros();
        }
    }

    function removerBeneficio(id){
        const beneficios = getBenefitCards();
        const beneficio = beneficios.find(item => item.id === id);
        if(!beneficio) return;
        const confirmar = window.confirm(`Deseja remover o cartão de benefício "${beneficio.nome}"?`);
        if(!confirmar) return;
        if(typeof dataService.removeBenefitCard === 'function'){
            dataService.removeBenefitCard(id);
        } else if(typeof dataService.setBenefitCards === 'function'){
            const atualizados = beneficios.filter(item => item.id !== id);
            dataService.setBenefitCards(atualizados);
        }
        renderBenefitCardsList();
        atualizarSidebar();
        atualizarSeletoresMetodos();
    }

    function editarBeneficio(id){
        const beneficios = getBenefitCards();
        const beneficio = beneficios.find(item => item.id === id);
        if(!beneficio) return;
        const saldoAtual = parseFloat(beneficio.saldo || 0);
        const valorPadrao = Number.isNaN(saldoAtual) ? '' : saldoAtual.toFixed(2).replace('.', ',');
        const entrada = window.prompt(`Informe o novo saldo para ${beneficio.nome}`, valorPadrao);
        if(entrada === null) return;
        const normalizado = entrada.replace(',', '.');
        const novoSaldo = parseFloat(normalizado);
        if(Number.isNaN(novoSaldo) || novoSaldo < 0){
            alert('Saldo inválido!');
            return;
        }
        if(typeof dataService.updateBenefitCard === 'function'){
            dataService.updateBenefitCard(id, { saldo: novoSaldo });
        } else if(typeof dataService.setBenefitCards === 'function'){
            const atualizados = beneficios.map(item => item.id === id ? Object.assign({}, item, { saldo: novoSaldo }) : item);
            dataService.setBenefitCards(atualizados);
        }
        renderBenefitCardsList();
        atualizarSidebar();
        atualizarSeletoresMetodos();
    }

    function verificarGastosRecorrentes() {
        const recorrentes = dataService.getGastosRecorrentes();
        if (!recorrentes.length) return;
        const hoje = new Date().toISOString().slice(0,10);
        const pendentes = recorrentes.filter(r => r.ativo && r.proximaData <= hoje);
        const alertEl = document.getElementById('recorrentes-alert');
        if (alertEl) alertEl.style.display = pendentes.length ? 'inline' : 'none';
        let houveAtualizacao = false;
        pendentes.forEach(r => {
            const confirmar = window.confirm(`Lançar gasto recorrente "${r.descricao}"?`);
            if (confirmar) {
                const lista = dataService.getGastos();
                lista.push({
                    descricao: r.descricao,
                    valor: r.valor,
                    data: hoje,
                    categoria: r.categoria,
                    categoriaId: resolverCategoriaId(r.categoria, r.categoriaId),
                    metodoPagamento: r.metodo
                });
                dataService.setGastos(lista);

                let next = new Date(r.proximaData);
                if (r.frequencia === 'mensal') next.setMonth(next.getMonth() + 1);
                if (r.frequencia === 'semanal') next.setDate(next.getDate() + 7);
                if (r.frequencia === 'anual') next.setFullYear(next.getFullYear() + 1);
                r.proximaData = next.toISOString().slice(0,10);
                houveAtualizacao = true;
            }
        });
        if(houveAtualizacao){
            dataService.setGastosRecorrentes(recorrentes);
        }
    }

    function atualizarSidebar() {
        const detalhes = obterRendaDetalhada();
        const rendaTotal = detalhes.total;
        const totalGastos = dataService.getTotalGastosMesAtual();
        atualizarResumoBeneficios(detalhes);

        if (rendaValor) {
            rendaValor.textContent = formatCurrency(rendaTotal);
        }

        if (sobraValor) {
            sobraValor.textContent = formatCurrency(rendaTotal - totalGastos);
        }

        if (typeof atualizarEstatisticasHero === 'function') {
            atualizarEstatisticasHero();
        }

        if (typeof atualizarDashboard === 'function') {
            atualizarDashboard();
        }
    }
    function abrirModalRenda() {
        if (!modal) return;
        const detalhes = obterRendaDetalhada();
        if (inputModalRenda) {
            inputModalRenda.value = detalhes.base > 0 ? detalhes.base : '';
        }
        renderBenefitCardsList(detalhes);
        modal.style.display = 'flex';
        setTimeout(() => { if (inputModalRenda) { inputModalRenda.focus(); } }, 100);
    }
    
    function fecharModalRenda() {
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Event listeners com verificação segura
    if (editarRendaBtn) {
        editarRendaBtn.addEventListener('click', abrirModalRenda);
    }
    
    if (modalClose) {
        modalClose.addEventListener('click', fecharModalRenda);
    }
    
    if (modalCancelar) {
        modalCancelar.addEventListener('click', fecharModalRenda);
    }
    
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) fecharModalRenda();
        });
    }
    
    if (formModalRenda) {
        formModalRenda.addEventListener('submit', function(e) {
            e.preventDefault();

            if (inputModalRenda) {
                let nova = inputModalRenda.value.replace(',', '.');
                const valor = parseFloat(nova);
                if (!isNaN(valor) && valor >= 0) {
                    if (typeof dataService.setRendaBase === 'function') {
                        dataService.setRendaBase(valor);
                    } else if (typeof dataService.setRenda === 'function') {
                        dataService.setRenda(valor);
                    }
                    atualizarSidebar();
                    renderBenefitCardsList();
                } else {
                    alert('Valor inválido!');
                }
            }
        });
    }

    if (formBeneficio) {
        formBeneficio.addEventListener('submit', function(e) {
            e.preventDefault();
            const nome = inputBeneficioNome ? inputBeneficioNome.value.trim() : '';
            const tipo = selectBeneficioTipo ? selectBeneficioTipo.value : 'outro';
            const saldoInput = inputBeneficioSaldo ? String(inputBeneficioSaldo.value).replace(',', '.') : '0';
            const saldo = parseFloat(saldoInput);
            if (!nome) {
                alert('Informe o nome do cartão de benefício.');
                return;
            }
            if (Number.isNaN(saldo) || saldo < 0) {
                alert('Informe um saldo válido para o benefício.');
                return;
            }
            const existentes = getBenefitCards();
            if (existentes.some(b => (b.nome || '').toLowerCase() === nome.toLowerCase())) {
                alert('Já existe um cartão de benefício com esse nome.');
                return;
            }
            const novo = {
                id: (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : `benef-${Date.now()}`,
                nome,
                tipo,
                saldo: Math.round(saldo * 100) / 100
            };
            if (typeof dataService.addBenefitCard === 'function') {
                dataService.addBenefitCard(novo);
            } else if (typeof dataService.setBenefitCards === 'function') {
                const listaAtualizada = existentes.concat([novo]);
                dataService.setBenefitCards(listaAtualizada);
            }
            renderBenefitCardsList();
            atualizarSidebar();
            atualizarSeletoresMetodos();
            formBeneficio.reset();
            if (selectBeneficioTipo) {
                selectBeneficioTipo.value = 'alimentacao';
            }
        });
    }

    if (listaBeneficios) {
        listaBeneficios.addEventListener('click', function(e) {
            const botao = e.target.closest('button');
            if (!botao || !botao.dataset || !botao.dataset.acao) return;
            const id = botao.dataset.id;
            if (!id) return;
            if (botao.dataset.acao === 'remover') {
                removerBeneficio(id);
            } else if (botao.dataset.acao === 'editar') {
                editarBeneficio(id);
            }
        });
    }
    // --- Fim renda/sobra ---

    // --- Gastos: salvar no localStorage ---
    const formGasto = document.getElementById('form-gasto');
    const selectMesAno = document.getElementById('mes-ano-gastos');

    function getMesAnoSelecionado() {
        const valorSelecionado = (selectMesAno && selectMesAno.value) ? selectMesAno.value : '';
        return valorSelecionado || dataService.getCurrentCycleKeyStr();
    }
    const chkRecorrente = document.getElementById('gasto-recorrente');
    const freqRecorrente = document.getElementById('freq-recorrente');
    const freqGroup = document.getElementById('freq-recorrente-group');

    // Função para obter todos os meses/anos presentes nos gastos
    // Função para preencher o select de meses/anos
    function preencherSelectMesAno() {
        if (!selectMesAno) {
            console.warn('Elemento "mes-ano-gastos" não encontrado. Filtro de mês desativado.');
            return;
        }
        const meses = dataService.getMesesAnosDisponiveis();
        selectMesAno.innerHTML = '';
        meses.forEach(m => {
            const [ano, mes] = m.split('-');
            const nomeMes = new Date(ano, mes-1).toLocaleString('pt-BR', { month: 'long' });
            const option = document.createElement('option');
            option.value = m;
            option.textContent = `${nomeMes.charAt(0).toUpperCase()+nomeMes.slice(1)} / ${ano}`;
            selectMesAno.appendChild(option);
        });
    }

    // Função para atualizar sidebar e histórico conforme mês selecionado
    function atualizarTudoPorMes() {
        const mesAno = getMesAnoSelecionado();
        const detalhes = obterRendaDetalhada();
        const totalGastos = dataService.getTotalGastosMes(mesAno);
        if (rendaValor) {
            rendaValor.textContent = formatCurrency(detalhes.total);
        }
        if (sobraValor) {
            sobraValor.textContent = formatCurrency(detalhes.total - totalGastos);
        }
        atualizarResumoBeneficios(detalhes);
        atualizarHistoricoGastos(mesAno);
        atualizarSeletoresMetodos();

        // Atualizar estatísticas do hero
        atualizarEstatisticasHero();

        // Sempre atualizar dashboard quando dados mudam
        if (typeof atualizarDashboard === 'function') {
            atualizarDashboard();
        }
    }

    // --- Categoria dinâmica ---
    const divCadastroCategoria = document.getElementById('sidebar-categoria-cadastro');
    const formCategoria = document.getElementById('form-categoria');
    const inputNomeCategoria = document.getElementById('nome-categoria');
    const inputCorCategoria = document.getElementById('cor-categoria');
    const selectCategoria = document.getElementById('categoria');

    // Carregar categorias do localStorage ou usar padrão
    function getCategoriasPersonalizadas() {
        return dataService.getCategoriasPersonalizadas();
    }
    function setCategoriasPersonalizadas(lista) {
        dataService.setCategoriasPersonalizadas(lista);
    }
    function getCategoriasRemovidas() {
        return dataService.getCategoriasRemovidas();
    }
    function setCategoriasRemovidas(lista) {
        dataService.setCategoriasRemovidas(lista);
    }
    function getTodasCategorias() {
        return dataService.getTodasCategorias();
    }
    function atualizarComboboxCategorias() {
        const categorias = getTodasCategorias();
        selectCategoria.innerHTML = '';
        categorias.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.valor;
            opt.textContent = cat.nome;
            opt.dataset.cor = cat.cor;
            opt.dataset.id = cat.id;
            selectCategoria.appendChild(opt);
        });
    }
    // Cadastro de nova categoria
    if (formCategoria) {
        formCategoria.addEventListener('submit', function(e) {
            e.preventDefault();
            const nome = inputNomeCategoria.value.trim();
            const cor = inputCorCategoria.value;
            if (!nome) return;
            // Garante valor único
            const valor = nome.toLowerCase().replace(/[^a-z0-9]/gi, '-');
            const lista = getCategoriasPersonalizadas();
            if (lista.some(cat => cat.valor === valor)) {
                alert('Já existe uma categoria com esse nome!');
                return;
            }
            const id = dataService.generateCategoriaId();
            lista.push({ id, nome, valor, cor });
            setCategoriasPersonalizadas(lista);
            atualizarComboboxCategorias();
            atualizarListaCategorias();
            inputNomeCategoria.value = '';
            inputCorCategoria.value = '#b388ff';
        });
    }
    // Atualizar combobox ao carregar
    atualizarComboboxCategorias();
    // Atualizar lista de categorias com botões de exclusão
    atualizarListaCategorias();

    // Mapeamento de cores das categorias
    const categoriaCores = {};
    getTodasCategorias().forEach(cat => { categoriaCores[cat.valor] = cat.cor; });
    
    // Atualiza visual da lista de categorias com exclusão
    function atualizarListaCategorias() {
        const listaContainer = document.getElementById('lista-categorias');
        if (!listaContainer) return;
        listaContainer.innerHTML = '';
        
        const categorias = getTodasCategorias();
        categorias.forEach(cat => {
            const li = document.createElement('li');
            li.className = 'sidebar-categoria-item';
            
            // Container da informação da categoria
            const infoDiv = document.createElement('div');
            infoDiv.className = 'categoria-info';
            
            // Círculo de cor com preview
            const corSpan = document.createElement('span');
            corSpan.className = 'categoria-cor-preview';
            corSpan.style.backgroundColor = cat.cor;
            
            // Nome da categoria
            const nomeSpan = document.createElement('span');
            nomeSpan.className = 'categoria-nome';
            nomeSpan.textContent = cat.nome;
            
            infoDiv.appendChild(corSpan);
            infoDiv.appendChild(nomeSpan);
            
            // Botão de exclusão moderno com ícone SVG
            const btn = document.createElement('button');
            btn.className = 'btn-excluir-categoria';
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 6h18M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2M19 6v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6" 
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            btn.title = `Excluir categoria ${cat.nome}`;
            btn.addEventListener('click', function() {
                tentarExcluirCategoria(cat.id, cat.nome, cat.valor);
            });
            
            li.appendChild(infoDiv);
            li.appendChild(btn);
            listaContainer.appendChild(li);
            
            // Adiciona animação de entrada
            setTimeout(() => {
                li.classList.add('new-item');
            }, 50);
        });
        
        // Adicionar contador de categorias ou estado vazio
        if (categorias.length > 0) {
            const counter = document.createElement('div');
            counter.className = 'categoria-counter';
            counter.textContent = `${categorias.length} categoria${categorias.length !== 1 ? 's' : ''} cadastrada${categorias.length !== 1 ? 's' : ''}`;
            listaContainer.appendChild(counter);
        } else {
            // Estado vazio quando não há categorias
            const emptyState = document.createElement('div');
            emptyState.className = 'categoria-empty-state';
            emptyState.textContent = 'Nenhuma categoria cadastrada ainda. Crie sua primeira categoria acima!';
            listaContainer.appendChild(emptyState);
        }
    }

    // Tenta excluir categoria, verificando uso em gastos
    function tentarExcluirCategoria(id, nome, valorCategoria) {
        const usados = dataService.findExpensesByCategoryId(id, valorCategoria);
        if (usados.length) {
            abrirModalCategoriaEmUso(nome, usados.length);
            return;
        }
        let personalizadas = getCategoriasPersonalizadas();
        if (personalizadas.some(c => c.id === id)) {
            personalizadas = personalizadas.filter(c => c.id !== id);
            setCategoriasPersonalizadas(personalizadas);
        } else {
            const removidas = getCategoriasRemovidas();
            removidas.push(id);
            setCategoriasRemovidas(removidas);
        }
        atualizarComboboxCategorias();
        atualizarListaCategorias();
    }

    // --- Modal de confirmação de exclusão ---
    const modalConfirmar = document.getElementById('modal-confirmar-exclusao');
    const btnConfirmarExclusao = document.getElementById('btn-confirmar-exclusao');
    const btnCancelarExclusao = document.getElementById('btn-cancelar-exclusao');
    const modalConfirmarClose = document.getElementById('modal-confirmar-exclusao-close');
    let mesAnoParaExcluir = null;
    let idxParaExcluir = null;

    // --- Modal de categoria em uso ---
    const modalCategoriaEmUso = document.getElementById('modal-categoria-em-uso');
    const btnEntendiCategoria = document.getElementById('btn-entendi-categoria');
    const modalCategoriaEmUsoClose = document.getElementById('modal-categoria-em-uso-close');
    const textoCategoriaEmUso = document.getElementById('texto-categoria-em-uso');

    function abrirModalConfirmarExclusao(mesAno, idx) {
        if (!modalConfirmar) return;
        mesAnoParaExcluir = mesAno;
        idxParaExcluir = idx;
        modalConfirmar.style.display = 'flex';
    }
    function fecharModalConfirmarExclusao() {
        if (!modalConfirmar) return;
        modalConfirmar.style.display = 'none';
        mesAnoParaExcluir = null;
        idxParaExcluir = null;
    }

    // Funções para o modal de categoria em uso
    function abrirModalCategoriaEmUso(nomeCategoria, quantidadeGastos) {
        if (!modalCategoriaEmUso || !textoCategoriaEmUso) return;
        textoCategoriaEmUso.innerHTML = `
            Não foi possível excluir a categoria <strong>"${nomeCategoria}"</strong>
            pois existem <strong>${quantidadeGastos} gasto(s)</strong> usando-a.
            <br><br>
            Para excluir esta categoria, primeiro remova ou altere a categoria
            dos gastos que a utilizam.
        `;
        modalCategoriaEmUso.style.display = 'flex';
    }

    function fecharModalCategoriaEmUso() {
        if (modalCategoriaEmUso) {
            modalCategoriaEmUso.style.display = 'none';
        }
    }
    if (btnCancelarExclusao) {
        btnCancelarExclusao.addEventListener('click', fecharModalConfirmarExclusao);
    }
    if (modalConfirmarClose) {
        modalConfirmarClose.addEventListener('click', fecharModalConfirmarExclusao);
    }
    if (modalConfirmar) {
        modalConfirmar.addEventListener('click', function(e) {
            if (e.target === modalConfirmar) fecharModalConfirmarExclusao();
        });
    }
    if (btnConfirmarExclusao) {
        btnConfirmarExclusao.addEventListener('click', function() {
            if (mesAnoParaExcluir && idxParaExcluir !== null) {
                excluirGastoDoMes(mesAnoParaExcluir, idxParaExcluir, true);
                fecharModalConfirmarExclusao();
            }
        });
    }
    // --- Fim modal confirmação ---

    // Event listeners para o modal de categoria em uso
    if (btnEntendiCategoria) {
        btnEntendiCategoria.addEventListener('click', fecharModalCategoriaEmUso);
    }
    if (modalCategoriaEmUsoClose) {
        modalCategoriaEmUsoClose.addEventListener('click', fecharModalCategoriaEmUso);
    }
    if (modalCategoriaEmUso) {
        modalCategoriaEmUso.addEventListener('click', function(e) {
            if (e.target === modalCategoriaEmUso) {
                fecharModalCategoriaEmUso();
            }
        });
    }

    // Atualiza tabela de gastos para o mês selecionado
    function atualizarHistoricoGastos(mesAno) {
        // Atualiza mapeamento de cores antes de renderizar histórico
        getTodasCategorias().forEach(cat => { categoriaCores[cat.valor] = cat.cor; });
        const lista = dataService.getGastosDoMesAno(mesAno);
        const tbody = document.querySelector('#historico-gastos tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        // Exibe em ordem reversa (mais recentes primeiro)
        const listaReversa = lista.slice().reverse();
        listaReversa.forEach((g, displayIdx) => {
           // Formatar data para dd-mm-YYYY
           const [ano, mes, dia] = g.data.split('-');
           const dataFormatada = `${dia}/${mes}/${ano}`;
            const cor = categoriaCores[g.categoria] || categoriaCores['outros'];
            const quadrado = `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${cor};margin-right:8px;vertical-align:middle;border:2px solid rgba(255,255,255,0.8);box-shadow:0 1px 3px rgba(0,0,0,0.2);"></span>`;
            
            // Separar descrição e categoria
            const descricao = `<div class="desc-cell">${g.descricao}</div>`;
            const categoria = `<div class="categoria-cell">${quadrado}<span>${g.categoria}</span></div>`;
            
            // Adicionar ícones aos métodos de pagamento
            const iconeMetodo = paymentIcons[g.metodoPagamento] || defaultPaymentIcon;
            const metodo = `<div class="metodo-cell">${iconeMetodo} ${g.metodoPagamento || 'Não informado'}</div>`;
            
            // Índice original na lista não-reversa
            const originalIdx = lista.length - 1 - displayIdx;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${descricao}</td><td class="valor-cell">${formatCurrency(g.valor)}</td><td>${categoria}</td><td>${metodo}</td><td class="data-cell">📅 ${dataFormatada}</td><td class="action-cell"><button class='btn-delete-modern' title='Excluir gasto' data-idx='${originalIdx}'>🗑️</button></td>`;
            tbody.appendChild(tr);
        });
        // Adiciona evento aos botões de exclusão
        document.querySelectorAll('.btn-delete-modern').forEach(btn => {
            btn.addEventListener('click', function() {
                const idx = parseInt(this.getAttribute('data-idx'));
                abrirModalConfirmarExclusao(mesAno, idx);
            });
        });
        // Atualiza mapeamento de cores caso novas categorias
        getTodasCategorias().forEach(cat => { categoriaCores[cat.valor] = cat.cor; });
    }

    // Função para excluir gasto do mês selecionado
    function excluirGastoDoMes(mesAno, idx, skipConfirm) {
        if (!skipConfirm) {
            abrirModalConfirmarExclusao(mesAno, idx);
            return;
        }
        
        // Validações de segurança
        if (!mesAno || idx === null || idx === undefined || idx < 0) {
            console.error('Parâmetros inválidos para exclusão de gasto');
            return;
        }
        
        const listaCompleta = dataService.getGastos();
        const listaMes = dataService.getGastosDoMesAno(mesAno);
        
        // Verifica se o índice é válido para o mês
        if (idx >= listaMes.length) {
            console.error('Índice inválido para lista do mês');
            return;
        }
        
        const gastoParaRemover = listaMes[idx];
        if (!gastoParaRemover) {
            console.error('Gasto não encontrado no índice especificado');
            return;
        }
        
        // Encontra índice real: prioridade por id único
        let indexReal = -1;
        if (gastoParaRemover.id !== undefined) {
            indexReal = listaCompleta.findIndex(item => item.id === gastoParaRemover.id);
        }
        
        if (indexReal === -1) {
            // fallback: comparativo detalhado
            indexReal = listaCompleta.findIndex(item =>
                item.descricao === gastoParaRemover.descricao &&
                parseFloat(item.valor) === parseFloat(gastoParaRemover.valor) &&
                item.data === gastoParaRemover.data &&
                item.categoria === gastoParaRemover.categoria &&
                (item.metodoPagamento || '') === (gastoParaRemover.metodoPagamento || '')
            );
        }
        
        if (indexReal > -1) {
            listaCompleta.splice(indexReal, 1);
            dataService.setGastos(listaCompleta);
            // refresca opções e exibição mantendo o mês selecionado
            preencherSelectMesAno();
            if (selectMesAno) {
                selectMesAno.value = mesAno;
            }
            atualizarTudoPorMes();
        } else {
            console.error('Não foi possível encontrar o gasto para exclusão');
        }
    }

    // Eventos do select
    if (selectMesAno) {
        selectMesAno.addEventListener('change', () => {
            atualizarTudoPorMes();
            if (chartsManager) {
                if (typeof chartsManager.renderCategoriaChart === 'function') {
                    chartsManager.renderCategoriaChart();
                }
                if (typeof chartsManager.renderMensalChart === 'function') {
                    chartsManager.renderMensalChart();
                }
            }
        });
    }

    // Ao adicionar gasto, atualizar select e exibição
    if (formGasto) {
        formGasto.addEventListener('submit', function(e) {
            e.preventDefault();
            const descricao = document.getElementById('descricao').value.trim();
            const valorTotal = parseFloat(document.getElementById('valor').value);
            const data = document.getElementById('data').value;
            const parcelas = parseInt(document.getElementById('parcelas').value) || 1;
            const categoriaSelect = document.getElementById('categoria');
            const categoria = categoriaSelect.value;
            const categoriaOption = categoriaSelect.options[categoriaSelect.selectedIndex];
            const categoriaId = resolverCategoriaId(categoria, categoriaOption ? categoriaOption.dataset.id : null);
            const metodoSelecionado = document.getElementById('metodo-pagamento').value;
            const outroMetodo = document.getElementById('outro-metodo').value.trim();
            const metodoPagamento = metodoSelecionado === 'Outro' ? (outroMetodo || 'Outro') : metodoSelecionado;
            const ehRecorrente = chkRecorrente && chkRecorrente.checked;
            const frequencia = freqRecorrente ? freqRecorrente.value : 'mensal';

            if (!descricao || isNaN(valorTotal) || !data || isNaN(parcelas) || parcelas < 1 || !categoria || !metodoPagamento) return;
            const lista = dataService.getGastos();
            // Corrigido: valor de cada parcela
            const valorParcela = Math.round((valorTotal / parcelas) * 100) / 100;
            let valorRestante = valorTotal;
            for (let i = 0; i < parcelas; i++) {
                const dataParcela = new Date(data);
                dataParcela.setMonth(dataParcela.getMonth() + i);
                // Ajuste para garantir que a soma das parcelas seja igual ao valor total
                let valorAtual = (i === parcelas - 1) ? Math.round((valorRestante) * 100) / 100 : valorParcela;
                valorRestante -= valorAtual;
                const descParcela = parcelas > 1 ? `${descricao} (${i+1}/${parcelas})` : descricao;
                lista.push({
                    descricao: descParcela,
                    valor: valorAtual,
                    data: dataParcela.toISOString().slice(0,10),
                    categoria,
                    categoriaId,
                    metodoPagamento
                });
            }
            dataService.setGastos(lista);

            if (ehRecorrente) {
                const rec = dataService.getGastosRecorrentes();
                rec.push({
                    id: crypto.randomUUID ? crypto.randomUUID() : Date.now(),
                    descricao,
                    valor: valorTotal,
                    categoria,
                    categoriaId,
                    metodo: metodoPagamento,
                    frequencia,
                    proximaData: data,
                    ativo: true,
                    criadoEm: new Date().toISOString()
                });
                dataService.setGastosRecorrentes(rec);
            }
            // Atualiza select de meses e seleciona o ciclo correto baseado no início do mês financeiro
            preencherSelectMesAno();
            const { year: cyYear, month: cyMonth } = dataService.getCycleKeyForDate(data);
            if (selectMesAno) {
                selectMesAno.value = `${cyYear}-${String(cyMonth).padStart(2,'0')}`;
            }
            // Atualiza UI e gráficos para o ciclo selecionado
            atualizarTudoPorMes();
            if (chartsManager) {
                if (typeof chartsManager.renderCategoriaChart === 'function') {
                    chartsManager.renderCategoriaChart();
                }
                if (typeof chartsManager.renderMensalChart === 'function') {
                    chartsManager.renderMensalChart();
                }
            }
            
            // Atualizar dashboard sempre que novos gastos são adicionados
            if (typeof atualizarDashboard === 'function') {
                atualizarDashboard();
            }
            
            formGasto.reset();
            document.getElementById('parcelas').value = 1;
        });
    }

    // Inicialização
    preencherSelectMesAno();
    if (selectMesAno) {
        selectMesAno.value = dataService.getCurrentCycleKeyStr();
    }
    atualizarTudoPorMes();
    verificarGastosRecorrentes();
    if (chartsManager && typeof chartsManager.refreshAll === 'function') {
        chartsManager.refreshAll();
    }

    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', () => {
            const sidebarCol = document.querySelector('.sidebar-col');
            if (sidebarCol) {
                sidebarCol.classList.toggle('show-sidebar');
            }
        });
    }

    function applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('tema_preferido', theme);
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const current = document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
            applyTheme(current === 'dark' ? 'default' : 'dark');
        });
    }

    const savedTheme = localStorage.getItem('tema_preferido') || 'default';
    applyTheme(savedTheme);

    const navLinks = document.querySelectorAll('.nav-list a[data-section]');
    const logoutLink = document.getElementById('logout-link');
    const sections = {
        'tela-gastos': document.getElementById('tela-gastos'),
        'tela-investimentos': document.getElementById('tela-investimentos'),
        'tela-configuracoes': document.getElementById('tela-configuracoes')
    };

    navLinks.forEach(link => {
        const targetId = link.dataset.section;
        if (targetId && !sections[targetId]) {
            sections[targetId] = document.getElementById(targetId);
        }
    });

    // Mostrar/esconder campo de método personalizado
    if (selectMetodo) {
        selectMetodo.addEventListener('change', function() {
            const divOutro = document.getElementById('div-outro-metodo');
            divOutro.style.display = this.value === 'Outro' ? 'block' : 'none';
        });
    }

    if (chkRecorrente && freqGroup) {
        chkRecorrente.addEventListener('change', function() {
            freqGroup.style.display = this.checked ? 'block' : 'none';
        });
    }

    if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
            e.preventDefault();
            localStorage.removeItem('autenticado');
            window.location.href = 'login.html';
        });
    }

    // Exibe a primeira tela por padrão
    showSection('tela-gastos');

    // Ao trocar de seção, mostrar/ocultar cadastro de categoria
    function showSection(sectionId) {
        Object.values(sections).forEach(sec => {
            if (sec) {
                sec.style.display = 'none';
            }
        });
        if (sections[sectionId]) {
            sections[sectionId].style.display = 'block';
        }
        if (divCadastroCategoria) {
            divCadastroCategoria.style.display = (sectionId === 'tela-gastos') ? 'block' : 'none';
        }
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const sectionId = this.dataset.section;
            if (sectionId) {
                showSection(sectionId);
            }
        });
    });

    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        bottomNav.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetButton = document.querySelector(`.tab-btn[data-tab="${btn.dataset.tab}"]`);
                if (targetButton) {
                    targetButton.click();
                }
            });
        });
    }

    let touchStartX = 0;
    document.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    });
    document.addEventListener('touchend', e => {
        const diff = e.changedTouches[0].screenX - touchStartX;
        if (Math.abs(diff) > 50) {
            const tabs = Array.from(tabButtons);
            let idx = tabs.findIndex(t => t.classList.contains('active'));
            if (diff < 0 && idx < tabs.length -1) idx++; else if (diff > 0 && idx > 0) idx--;
            tabs[idx].click();
        }
    });

    // --- Sub-abas em Gráficos ---
    // Lógica de abas dos gráficos com animações
    const grafTabBtns = document.querySelectorAll('.tab-grafico-btn');
    const subtabContents = document.querySelectorAll('.subtab-content');
    
    grafTabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const subtabId = this.dataset.subtab;
            const targetSubtab = document.getElementById(subtabId);
            
            // Se já está ativo, não faz nada
            if (this.classList.contains('active')) return;
            
            // Remove active de todos os botões
            grafTabBtns.forEach(b => b.classList.remove('active'));
            
            // Oculta todas as abas com fade out
            subtabContents.forEach(c => {
                if (c.style.display !== 'none') {
                    c.style.opacity = '0';
                    c.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        c.style.display = 'none';
                    }, 300);
                }
            });
            
            // Ativa o botão clicado
            this.classList.add('active');
            
            // Mostra a aba selecionada com fade in
            setTimeout(() => {
                targetSubtab.style.display = 'block';
                targetSubtab.style.opacity = '0';
                targetSubtab.style.transform = 'translateY(20px)';
                
                // Força reflow
                targetSubtab.offsetHeight;
                
                // Anima entrada
                targetSubtab.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                targetSubtab.style.opacity = '1';
                targetSubtab.style.transform = 'translateY(0)';
                
                // Re-render o gráfico específico
                setTimeout(() => {
                    if (subtabId === 'subtab-categoria') {
                        chartsManager.renderCategoriaChart();
                    } else if (subtabId === 'subtab-mensal') {
                        chartsManager.renderMensalChart();
                    }
                }, 200);
                
            }, 320);
        });
    });

    const categoriaCanvas = document.getElementById('chartCategoria');
    const mensalCanvas = document.getElementById('chartMensal');
    const metodosCanvas = document.getElementById('chart-metodos');
    if (chartsManager && typeof chartsManager.init === 'function') {
        chartsManager.init({
            selectMesAno,
            categoriaCanvas,
            mensalCanvas,
            metodosCanvas
        });
    }
    // Configuração do dia de início do mês financeiro: inicializa campo e salva valor
    const formConfig = document.getElementById('form-config');
    const inputDiaInicioMes = document.getElementById('dia-inicio-mes');
    if (inputDiaInicioMes) {
        inputDiaInicioMes.value = dataService.getInicioMes();
    }
    if (formConfig && inputDiaInicioMes) {
        formConfig.addEventListener('submit', function(e) {
            e.preventDefault();
            const dia = parseInt(inputDiaInicioMes.value, 10);
            if (!isNaN(dia) && dia >= 1 && dia <= 28) {
                dataService.setInicioMes(dia);
                preencherSelectMesAno();
                atualizarTudoPorMes();
                if (chartsManager) {
                    if (typeof chartsManager.renderCategoriaChart === 'function') {
                        chartsManager.renderCategoriaChart();
                    }
                    if (typeof chartsManager.renderMensalChart === 'function') {
                        chartsManager.renderMensalChart();
                    }
                }
                alert('Configurações salvas com sucesso!');
            } else {
                alert('Por favor, insira um dia entre 1 e 28.');
            }
        });
    }

    // ----- Metas por categoria -----
    const formMetas = document.getElementById('form-metas');
    const metasContainer = document.getElementById('metas-container');

    function preencherMetasForm() {
        if (!metasContainer) return;
        metasContainer.innerHTML = '';
        const categorias = getTodasCategorias();
        const metas = dataService.getMetas();
        categorias.forEach(cat => {
            const div = document.createElement('div');
            div.className = 'form-group';
            const label = document.createElement('label');
            label.textContent = cat.nome;
            label.setAttribute('for', 'meta-' + cat.id);
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.step = '0.01';
            input.id = 'meta-' + cat.id;
            input.value = metas[cat.id] || '';
            div.appendChild(label);
            div.appendChild(input);
            metasContainer.appendChild(div);
        });
    }

    if (formMetas) {
        preencherMetasForm();
        formMetas.addEventListener('submit', function(e) {
            e.preventDefault();
            const metas = {};
            getTodasCategorias().forEach(cat => {
                const val = parseFloat(document.getElementById('meta-' + cat.id).value);
                if (!isNaN(val)) metas[cat.id] = val;
            });
            dataService.setMetas(metas);
            alert('Metas salvas!');
            atualizarEstatisticasHero();
        });
    }
    
    // === FUNCIONALIDADE DOS FILTROS DO HISTÓRICO ===
    
    // Elementos dos filtros
    const viewToggleBtns = document.querySelectorAll('.toggle-btn');
    const tableView = document.getElementById('table-view');
    const cardsView = document.getElementById('cards-view');
    
    // Variáveis de controle
    let currentView = 'table';
    let gastosOriginais = [];
    let gastosFiltrados = [];
    
    // Função para aplicar todos os filtros
    function aplicarFiltros() {
        const mesAno = getMesAnoSelecionado();
        gastosOriginais = dataService.getGastosDoMesAno(mesAno);

        let gastosFiltrados = [...gastosOriginais];

        // Filtro de busca por descrição
        const textoBusca = (searchHistorico ? searchHistorico.value : '').toLowerCase().trim();
        if (textoBusca) {
            gastosFiltrados = gastosFiltrados.filter(gasto =>
                gasto.descricao.toLowerCase().includes(textoBusca)
            );
        }

        // Filtro por categoria
        const categoriaFiltro = filterCategoriaHistorico ? filterCategoriaHistorico.value : '';
        if (categoriaFiltro) {
            gastosFiltrados = gastosFiltrados.filter(gasto =>
                gasto.categoria === categoriaFiltro
            );
        }

        // Filtro por método de pagamento
        const metodoFiltro = filterMetodoHistorico ? filterMetodoHistorico.value : '';
        if (metodoFiltro) {
            gastosFiltrados = gastosFiltrados.filter(gasto =>
                gasto.metodoPagamento === metodoFiltro
            );
        }
        
        // Atualizar visualização
        if (currentView === 'table') {
            atualizarTabelaFiltrada(gastosFiltrados);
        } else {
            atualizarCardsFiltrados(gastosFiltrados);
        }
        
        // Atualizar estatísticas
        atualizarEstatisticasHistorico(gastosFiltrados);
    }
    
    // Função para atualizar tabela com dados filtrados
    function atualizarTabelaFiltrada(gastos) {
        const tbody = document.querySelector('#historico-gastos tbody');
        const emptyState = document.getElementById('empty-state-table');
        
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (gastos.length === 0) {
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        
        // Exibe em ordem reversa (mais recentes primeiro)
        const listaReversa = gastos.slice().reverse();
        listaReversa.forEach((g, displayIdx) => {
            // Formatar data para dd/mm/YYYY
            const [ano, mes, dia] = g.data.split('-');
            const dataFormatada = `${dia}/${mes}/${ano}`;
            const cor = categoriaCores[g.categoria] || categoriaCores['outros'];
            const quadrado = `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${cor};margin-right:8px;vertical-align:middle;border:2px solid rgba(255,255,255,0.8);box-shadow:0 1px 3px rgba(0,0,0,0.2);"></span>`;
            
            // Separar descrição e categoria
            const descricao = `<div class="desc-cell">${g.descricao}</div>`;
            const categoria = `<div class="categoria-cell">${quadrado}<span>${g.categoria}</span></div>`;
            
        // Adicionar ícones aos métodos de pagamento
        const iconeMetodo = paymentIcons[g.metodoPagamento] || defaultPaymentIcon;
            const metodo = `<div class="metodo-cell">${iconeMetodo} ${g.metodoPagamento || 'Não informado'}</div>`;
            
            // Encontrar índice original para exclusão
            const originalIdx = gastosOriginais.findIndex(original => 
                original.descricao === g.descricao && 
                original.valor === g.valor && 
                original.data === g.data
            );
            
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${descricao}</td><td class="valor-cell">${formatCurrency(g.valor)}</td><td>${categoria}</td><td>${metodo}</td><td class="data-cell">📅 ${dataFormatada}</td><td class="action-cell"><button class='btn-delete-modern' title='Excluir gasto' data-idx='${originalIdx}'>🗑️</button></td>`;
            tbody.appendChild(tr);
        });
        
        // Adiciona evento aos botões de exclusão
        document.querySelectorAll('.btn-delete-modern').forEach(btn => {
            btn.addEventListener('click', function() {
                const idx = parseInt(this.getAttribute('data-idx'));
                const mesAno = getMesAnoSelecionado();
                abrirModalConfirmarExclusao(mesAno, idx);
            });
        });
    }
    
    // Função para atualizar cards com dados filtrados
    function atualizarCardsFiltrados(gastos) {
        const cardsContainer = document.getElementById('gastos-cards-container');
        const emptyState = document.getElementById('empty-state-cards');
        
        if (!cardsContainer) return;
        
        cardsContainer.innerHTML = '';
        
        if (gastos.length === 0) {
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        
        // Exibe em ordem reversa (mais recentes primeiro)
        const listaReversa = gastos.slice().reverse();
        listaReversa.forEach((g, displayIdx) => {
            // Formatar data
            const [ano, mes, dia] = g.data.split('-');
            const dataFormatada = `${dia}/${mes}/${ano}`;
            const cor = categoriaCores[g.categoria] || categoriaCores['outros'];
            
        // Ícones dos métodos
        const iconeMetodo = paymentIcons[g.metodoPagamento] || defaultPaymentIcon;
            
            // Encontrar índice original para exclusão
            const originalIdx = gastosOriginais.findIndex(original => 
                original.descricao === g.descricao && 
                original.valor === g.valor && 
                original.data === g.data
            );
            
            const card = document.createElement('div');
            card.className = 'gasto-card';
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-categoria" style="background-color: ${cor}20; border-color: ${cor}">
                        <span style="color: ${cor}">●</span> ${g.categoria}
                    </div>
                    <div class="card-valor">${formatCurrency(g.valor)}</div>
                </div>
                <div class="card-descricao">${g.descricao}</div>
                <div class="card-details">
                    <div class="card-detail">
                        ${iconeMetodo} ${g.metodoPagamento || 'Não informado'}
                    </div>
                    <div class="card-detail">
                        📅 ${dataFormatada}
                    </div>
                </div>
                <div class="card-actions">
                    <button class='btn-delete-modern' title='Excluir gasto' data-idx='${originalIdx}'>🗑️</button>
                </div>
            `;
            cardsContainer.appendChild(card);
        });
        
        // Adiciona evento aos botões de exclusão
        document.querySelectorAll('.btn-delete-modern').forEach(btn => {
            btn.addEventListener('click', function() {
                const idx = parseInt(this.getAttribute('data-idx'));
                const mesAno = getMesAnoSelecionado();
                abrirModalConfirmarExclusao(mesAno, idx);
            });
        });
    }
    
    // Função para atualizar estatísticas do histórico
    function atualizarEstatisticasHistorico(gastos) {
        const totalElement = document.getElementById('total-gastos-historico');
        const quantidadeElement = document.getElementById('quantidade-gastos-historico');
        const mediaElement = document.getElementById('media-gastos-historico');
        
        if (!totalElement || !quantidadeElement || !mediaElement) return;
        
        const total = gastos.reduce((sum, gasto) => sum + parseFloat(gasto.valor), 0);
        const quantidade = gastos.length;
        const media = quantidade > 0 ? total / quantidade : 0;
        
        totalElement.textContent = formatCurrency(total);
        quantidadeElement.textContent = `${quantidade} gasto${quantidade !== 1 ? 's' : ''}`;
        mediaElement.textContent = formatCurrency(media);
    }
    
    // Função para popular filtro de categorias
    function popularFiltroCategoria() {
        if (!filterCategoriaHistorico) return;
        
        // Limpar opções existentes (exceto a primeira)
        const primeiraOpcao = filterCategoriaHistorico.querySelector('option[value=""]');
        filterCategoriaHistorico.innerHTML = '';
        filterCategoriaHistorico.appendChild(primeiraOpcao);
        
        // Adicionar categorias disponíveis
        const categorias = getTodasCategorias();
        categorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.valor;
            option.textContent = `${cat.nome}`;
            filterCategoriaHistorico.appendChild(option);
        });
    }
    
    // Função para alternar visualização
    function alternarVisualizacao(novaView) {
        currentView = novaView;
        
        // Atualizar botões
        viewToggleBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === novaView) {
                btn.classList.add('active');
            }
        });
        
        // Alternar visualizações
        if (novaView === 'table') {
            tableView.style.display = 'block';
            cardsView.style.display = 'none';
        } else {
            tableView.style.display = 'none';
            cardsView.style.display = 'block';
        }
        
        // Reaplicar filtros
        aplicarFiltros();
    }
    
    // Event Listeners dos filtros
    if (searchHistorico) {
        searchHistorico.addEventListener('input', aplicarFiltros);
    }
    
    if (filterCategoriaHistorico) {
        filterCategoriaHistorico.addEventListener('change', aplicarFiltros);
    }
    
    if (filterMetodoHistorico) {
        filterMetodoHistorico.addEventListener('change', aplicarFiltros);
    }
    
    // Event Listeners do toggle de visualização
    viewToggleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.dataset.view;
            if (view !== currentView) {
                alternarVisualizacao(view);
            }
        });
    });
    
    // Modificar a função original para usar os filtros
    const atualizarHistoricoOriginal = atualizarHistoricoGastos;
    atualizarHistoricoGastos = function(mesAno) {
        // Atualizar mapeamento de cores
        getTodasCategorias().forEach(cat => { categoriaCores[cat.valor] = cat.cor; });
        
        // Popular filtro de categoria
        popularFiltroCategoria();
        
        // Limpar filtros
        if (searchHistorico) searchHistorico.value = '';
        if (filterCategoriaHistorico) filterCategoriaHistorico.value = '';
        if (filterMetodoHistorico) filterMetodoHistorico.value = '';
        
        // Aplicar filtros (que vai chamar a renderização)
        aplicarFiltros();
    };
    
    // === FIM DOS FILTROS DO HISTÓRICO ===

    // === DASHBOARD ESTATÍSTICAS AVANÇADAS ===
    
    // Função para criar gráfico de métodos de pagamento
    // Função para atualizar o dashboard
    function atualizarDashboard() {
        // Atualizar estatísticas principais
        const maiorGasto = dataService.getMaiorGasto();
        const categoriaDominante = dataService.getCategoriaDominante();
        const tendencia = dataService.getTendenciaGastos();
        const projecao = dataService.getProjecaoMensal();
        
        // Atualizar elementos do DOM
        const maiorGastoEl = document.getElementById('maior-gasto');
        const categoriaDominanteEl = document.getElementById('categoria-dominante');
        const tendenciaEl = document.getElementById('tendencia-gastos');
        const projecaoEl = document.getElementById('projecao-mensal');
        
        if (maiorGastoEl) {
            maiorGastoEl.textContent = formatCurrency(maiorGasto.valor);
            // Adicionar classe para valores muito altos
            if (maiorGasto.valor > 1000) {
                maiorGastoEl.classList.add('long-text');
            }
        }
        
        if (categoriaDominanteEl) {
            categoriaDominanteEl.textContent = categoriaDominante.categoria;
            // Adicionar classe para nomes longos de categoria
            if (categoriaDominante.categoria.length > 15) {
                categoriaDominanteEl.classList.add('long-text');
                categoriaDominanteEl.parentElement.querySelector('.stat-label').classList.add('long-text');
            }
        }
        
        if (tendenciaEl) {
            tendenciaEl.textContent = tendencia;
            // Adicionar classe se texto da tendência for longo
            if (tendencia.length > 10) {
                tendenciaEl.classList.add('long-text');
            }
        }
        
        if (projecaoEl) {
            projecaoEl.textContent = formatCurrency(projecao);
            // Adicionar classe para valores de projeção altos
            if (projecao > 10000) {
                projecaoEl.classList.add('long-text');
            }
        }
        
        // Atualizar comparativo mensal
        const comparativo = dataService.getComparativoMesAnterior();
        const comparativoAtualEl = document.getElementById('comparativo-atual');
        const comparativoAnteriorEl = document.getElementById('comparativo-anterior');
        const variacaoPercentualEl = document.getElementById('variacao-percentual');
        const variacaoIndicadorEl = document.getElementById('variacao-indicador');
        
        if (comparativoAtualEl) {
            comparativoAtualEl.textContent = formatCurrency(comparativo.atual);
        }
        
        if (comparativoAnteriorEl) {
            comparativoAnteriorEl.textContent = formatCurrency(comparativo.anterior);
        }
        
        if (variacaoPercentualEl) {
            const sinal = comparativo.variacao > 0 ? '+' : '';
            variacaoPercentualEl.textContent = `${sinal}${comparativo.variacao.toFixed(1)}%`;
        }
        
        if (variacaoIndicadorEl) {
            variacaoIndicadorEl.textContent = comparativo.indicador;
        }
        
        // Atualizar timeline de gastos importantes
        atualizarTimelineGastos();
        
        // Criar gráfico de métodos
        chartsManager.renderMetodosChart();
    }
    
    // Função para atualizar timeline de gastos importantes
    function atualizarTimelineGastos() {
        const timelineContainer = document.getElementById('timeline-gastos');
        if (!timelineContainer) return;
        
        const gastosImportantes = dataService.getUltimosGastosImportantes();
        
        if (gastosImportantes.length === 0) {
            timelineContainer.innerHTML = '<p style="text-align: center; color: rgba(77, 102, 25, 0.6); padding: 1rem;">Nenhum gasto importante encontrado</p>';
            return;
        }
        
        const timelineHTML = gastosImportantes.map(gasto => {
            const [ano, mes, dia] = gasto.data.split('-');
            const dataFormatada = `${dia}/${mes}`;
            
            return `
                <div class="timeline-item">
                    <div class="timeline-content">
                        <div class="timeline-desc">${gasto.descricao}</div>
                        <div class="timeline-details">
                            <span class="timeline-valor">${formatCurrency(gasto.valor)}</span>
                            <span class="timeline-categoria">${gasto.categoria} • ${dataFormatada}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        timelineContainer.innerHTML = timelineHTML;
    }
    
    // === FIM DASHBOARD ESTATÍSTICAS AVANÇADAS ===

    // === ESTATÍSTICAS DO HERO ===
    
    // Função para calcular gastos de hoje
    // Função para atualizar as estatísticas do hero
    function atualizarEstatisticasHero() {
        const gastosHojeElement = document.getElementById('gastos-hoje');
        const metaMesElement = document.getElementById('meta-mes');
        const metaBar = document.getElementById('meta-progress-bar');
        
        if (gastosHojeElement) {
            const quantidadeHoje = dataService.getQuantidadeGastosHoje();
            const totalHoje = dataService.getTotalGastosHoje();
            
            if (quantidadeHoje > 0) {
                gastosHojeElement.textContent = `${quantidadeHoje} (${formatCurrency(totalHoje)})`;
            } else {
                gastosHojeElement.textContent = '0';
            }
        }
        
        if (metaMesElement) {
            const { totalMeta, progresso } = dataService.calcularProgressoMetas();
            if (totalMeta > 0) {
                metaMesElement.textContent = `${Math.min(progresso*100,100).toFixed(0)}%`;
                if (metaBar) metaBar.style.width = Math.min(progresso*100,100) + '%';
                if (progresso >= 1 && !metaMesElement.classList.contains('meta-excedida')) {
                    metaMesElement.classList.add('meta-excedida');
                    alert('Meta do mês atingida!');
                } else if (progresso >= 0.8) {
                    metaMesElement.classList.add('meta-quase');
                } else {
                    metaMesElement.classList.remove('meta-quase','meta-excedida');
                }
            } else {
                metaMesElement.textContent = '-';
                if (metaBar) metaBar.style.width = '0%';
            }
        }
    }
    
    // === FIM ESTATÍSTICAS HERO ===
    
    // ==========================================
    // CONFIGURAÇÃO FINAL DAS ABAS
    // ==========================================
    
    // Aguardar um frame para garantir que tudo está renderizado
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    function handleTabClick(e) {
        e.preventDefault();
        e.stopPropagation();

        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.style.display = 'none');

        this.classList.add('active');
        const target = this.dataset.tab;
        const targetElement = document.getElementById(target);

        if (targetElement) {
            targetElement.style.display = 'block';

            if (target === 'tab-graficos') {
                setTimeout(() => {
                    if (chartsManager && typeof chartsManager.renderCategoriaChart === 'function') {
                        chartsManager.renderCategoriaChart();
                    }
                    if (chartsManager && typeof chartsManager.renderMensalChart === 'function') {
                        chartsManager.renderMensalChart();
                    }
                }, 100);
            }
            if (target === 'tab-dashboard') {
                setTimeout(() => {
                    if (typeof atualizarDashboard === 'function') atualizarDashboard();
                }, 100);
            }
        }
    }

    tabButtons.forEach(btn => {
        btn.removeEventListener('click', handleTabClick);
        btn.addEventListener('click', handleTabClick);
    });
    
    // Inicializar dashboard na inicialização da página
    if (typeof atualizarDashboard === 'function') {
        atualizarDashboard();
    }

    }

    return { init };
});
