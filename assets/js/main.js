// main.js
// Navegação entre telas baseada na navbar principal
document.addEventListener('DOMContentLoaded', function () {
    // Redireciona para a tela de login se não estiver autenticado
    if (!localStorage.getItem('autenticado')) {
        window.location.href = 'login.html';
        return;
    }

    // --- Renda e sobra ---
    const rendaKey = 'renda_usuario';
    const gastosKey = 'gastos_usuario';
    const rendaValor = document.getElementById('sidebar-renda-valor');
    const sobraValor = document.getElementById('sidebar-sobra-valor');
    const editarRendaBtn = document.getElementById('editar-renda-btn');

    // Modal elementos
    const modal = document.getElementById('modal-editar-renda');
    const modalClose = document.getElementById('modal-editar-renda-close');
    const modalCancelar = document.getElementById('modal-editar-renda-cancelar');
    const formModalRenda = document.getElementById('form-modal-renda');
    const inputModalRenda = document.getElementById('input-modal-renda');

    function formatarReal(valor) {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function getRenda() {
        return parseFloat(localStorage.getItem(rendaKey)) || 0;
    }
    function setRenda(valor) {
        localStorage.setItem(rendaKey, valor);
    }
    function getGastos() {
        const lista = JSON.parse(localStorage.getItem(gastosKey) || '[]');
        return lista;
    }
    // Função para calcular total de gastos do ciclo financeiro atual
    function getTotalGastosMesAtual() {
        const cicloAtual = getCurrentCycleKeyStr();
        return getGastosDoMesAno(cicloAtual).reduce((soma, g) => soma + parseFloat(g.valor), 0);
    }

    // --- Configurações de ciclo financeiro ---
     const configKey = 'config_inicio_mes';
     function getInicioMes() { return parseInt(localStorage.getItem(configKey), 10) || 1; }
     function setInicioMes(dia) { localStorage.setItem(configKey, dia); }

     // Helper: determina o ciclo (ano e mês) de uma data com base no dia de início
     function getCycleKeyForDate(data) {
         const startDay = getInicioMes();
         let day, month, year;
         if (typeof data === 'string' && data.includes('-')) {
             // Parse date string YYYY-MM-DD without timezone offset
             const parts = data.split('-');
             year = parseInt(parts[0], 10);
             month = parseInt(parts[1], 10);
             day = parseInt(parts[2], 10);
         } else if (data instanceof Date) {
             day = data.getDate();
             month = data.getMonth() + 1;
             year = data.getFullYear();
         } else {
             const d = new Date(data);
             day = d.getDate();
             month = d.getMonth() + 1;
             year = d.getFullYear();
         }
          if (day < startDay) {
              month -= 1;
              if (month < 1) { month = 12; year -= 1; }
          }
          return { year, month };
     }
     // Retorna string 'YYYY-MM' do ciclo atual
     function getCurrentCycleKeyStr() {
         const now = new Date();
         const { year, month } = getCycleKeyForDate(now);
         return `${year}-${String(month).padStart(2,'0')}`;
     }

    function atualizarSidebar() {
        const renda = getRenda();
        const totalGastos = getTotalGastosMesAtual();
        rendaValor.textContent = formatarReal(renda);
        sobraValor.textContent = formatarReal(renda - totalGastos);
        
        // Atualizar estatísticas do hero
        atualizarEstatisticasHero();
    }
    function abrirModalRenda() {
        inputModalRenda.value = getRenda() > 0 ? getRenda() : '';
        modal.style.display = 'flex';
        setTimeout(() => { inputModalRenda.focus(); }, 100);
    }
    function fecharModalRenda() {
        modal.style.display = 'none';
    }

    editarRendaBtn.addEventListener('click', abrirModalRenda);
    modalClose.addEventListener('click', fecharModalRenda);
    modalCancelar.addEventListener('click', fecharModalRenda);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) fecharModalRenda();
    });
    formModalRenda.addEventListener('submit', function(e) {
        e.preventDefault();
        let nova = inputModalRenda.value.replace(',', '.');
        const valor = parseFloat(nova);
        if (!isNaN(valor) && valor >= 0) {
            setRenda(valor);
            atualizarSidebar();
            fecharModalRenda();
        } else {
            alert('Valor inválido!');
        }
    });
    // --- Fim renda/sobra ---

    // --- Gastos: salvar no localStorage ---
    const formGasto = document.getElementById('form-gasto');
    const selectMesAno = document.getElementById('mes-ano-gastos');

    // Adiciona o evento de submit ao formulário de gastos
    if (formGasto) {
        formGasto.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const descricao = document.getElementById('descricao').value;
            const valor = parseFloat(document.getElementById('valor').value);
            const data = document.getElementById('data').value;
            const parcelas = parseInt(document.getElementById('parcelas').value) || 1;
            const categoria = document.getElementById('categoria').value;
            let metodo = document.getElementById('metodo-pagamento').value;
            if (metodo === 'Outro') {
                const outro = document.getElementById('outro-metodo').value.trim();
                metodo = outro || metodo;
            }

            if (descricao && !isNaN(valor) && data && !isNaN(parcelas)) {
                const gastos = getGastos();
                const id = Date.now();

                if (parcelas === 1) {
                    gastos.push({ id, descricao, valor, data, categoria, metodoPagamento: metodo, parcela: 1, totalParcelas: 1 });
                } else {
                    for (let i = 1; i <= parcelas; i++) {
                        const dataParcela = new Date(data);
                        dataParcela.setMonth(dataParcela.getMonth() + i - 1);
                        
                        gastos.push({ id: `${id}_${i}`, descricao: `${descricao} (${i}/${parcelas})`, valor, data: dataParcela.toISOString().split('T')[0], categoria, metodoPagamento: metodo, parcela: i, totalParcelas: parcelas });
                    }
                }

                localStorage.setItem(gastosKey, JSON.stringify(gastos));

                // Limpa o formulário, atualiza a UI e re-renderiza gráficos
                formGasto.reset();
                preencherSelectMesAno();
                atualizarTudoPorMes();
                renderCategoriaChart();
                renderMensalChart();
            } else {
                alert('Por favor, preencha todos os campos corretamente.');
            }
        });
    }

    // Função para obter todos os meses/anos presentes nos gastos
    function getMesesAnosDisponiveis() {
        const lista = getGastos();
        const meses = new Set();
        lista.forEach(g => {
            const dataObj = new Date(g.data);
            const { year, month } = getCycleKeyForDate(dataObj);
            meses.add(`${year}-${String(month).padStart(2,'0')}`);
        });
        // Inclui o ciclo atual
        meses.add(getCurrentCycleKeyStr());
        // Ordena do mais recente para o mais antigo
        return Array.from(meses).sort((a,b)=>b.localeCompare(a));
    }

    // Função para preencher o select de meses/anos
    function preencherSelectMesAno() {
        const meses = getMesesAnosDisponiveis();
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

    // Função para obter gastos de um mês/ano específico
    function getGastosDoMesAno(mesAno) {
        const lista = getGastos();
        const [anoStr, mesStr] = mesAno.split('-');
        const ano = parseInt(anoStr, 10);
        const mes = parseInt(mesStr, 10);
        return lista.filter(g => {
            const dataObj = new Date(g.data);
            const { year, month } = getCycleKeyForDate(dataObj);
            return year === ano && month === mes;
        });
    }

    // Função para calcular total de gastos do mês selecionado
    function getTotalGastosMes(mesAno) {
        return getGastosDoMesAno(mesAno).reduce((soma, g) => soma + parseFloat(g.valor), 0);
    }

    // Função para atualizar sidebar e histórico conforme mês selecionado
    function atualizarTudoPorMes() {
        const mesAno = selectMesAno.value;
        const renda = getRenda();
        const totalGastos = getTotalGastosMes(mesAno);
        rendaValor.textContent = formatarReal(renda);
        sobraValor.textContent = formatarReal(renda - totalGastos);
        atualizarHistoricoGastos(mesAno);
        
        // Atualizar estatísticas do hero
        atualizarEstatisticasHero();
    }

    // --- Categoria dinâmica ---
    const divCadastroCategoria = document.getElementById('sidebar-categoria-cadastro');
    const formCategoria = document.getElementById('form-categoria');
    const inputNomeCategoria = document.getElementById('nome-categoria');
    const inputCorCategoria = document.getElementById('cor-categoria');
    const selectCategoria = document.getElementById('categoria');

    // Carregar categorias do localStorage ou usar padrão
    function getCategoriasPersonalizadas() {
        return JSON.parse(localStorage.getItem('categorias_usuario') || '[]');
    }
    function setCategoriasPersonalizadas(lista) {
        localStorage.setItem('categorias_usuario', JSON.stringify(lista));
    }
    // Persist removed categories to block deleted defaults and customs
    function getCategoriasRemovidas() {
        return JSON.parse(localStorage.getItem('categorias_removidas') || '[]');
    }
    function setCategoriasRemovidas(lista) {
        localStorage.setItem('categorias_removidas', JSON.stringify(lista));
    }
    function getTodasCategorias() {
        const padrao = [
            { nome: 'Alimentação', valor: 'alimentacao', cor: '#ffb347' },
            { nome: 'Transporte', valor: 'transporte', cor: '#6ec6ff' },
            { nome: 'Lazer', valor: 'lazer', cor: '#b388ff' },
            { nome: 'Saúde', valor: 'saude', cor: '#81c784' },
            { nome: 'Outros', valor: 'outros', cor: '#e0e0e0' }
        ];
        const personalizadas = getCategoriasPersonalizadas();
        const removidas = getCategoriasRemovidas();
        return [...padrao, ...personalizadas].filter(cat => !removidas.includes(cat.valor));
    }
    function atualizarComboboxCategorias() {
        const categorias = getTodasCategorias();
        selectCategoria.innerHTML = '';
        categorias.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.valor || cat.nome.toLowerCase().replace(/[^a-z0-9]/gi, '-');
            opt.textContent = cat.nome;
            opt.setAttribute('data-cor', cat.cor);
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
            lista.push({ nome, valor, cor });
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
            
            // Botão de exclusão moderno
            const btn = document.createElement('button');
            btn.className = 'btn-excluir-categoria';
            btn.textContent = 'Excluir';
            btn.title = `Excluir categoria ${cat.nome}`;
            btn.addEventListener('click', function() {
                tentarExcluirCategoria(cat.valor, cat.nome);
            });
            
            li.appendChild(infoDiv);
            li.appendChild(btn);
            listaContainer.appendChild(li);
            
            // Adiciona animação de entrada
            setTimeout(() => {
                li.classList.add('new-item');
            }, 50);
        });
        
        // Adicionar contador de categorias
        if (categorias.length > 0) {
            const counter = document.createElement('div');
            counter.className = 'categoria-counter';
            counter.textContent = `${categorias.length} categoria${categorias.length !== 1 ? 's' : ''} cadastrada${categorias.length !== 1 ? 's' : ''}`;
            listaContainer.appendChild(counter);
        }
    }

    // Tenta excluir categoria, verificando uso em gastos
    function tentarExcluirCategoria(valor, nome) {
        const gastos = getGastos();
        const usados = gastos.filter(g => g.categoria === valor);
        if (usados.length) {
            abrirModalCategoriaEmUso(nome, usados.length);
            return;
        }
        let personalizadas = getCategoriasPersonalizadas();
        if (personalizadas.some(c => c.valor === valor)) {
            personalizadas = personalizadas.filter(c => c.valor !== valor);
            setCategoriasPersonalizadas(personalizadas);
        } else {
            const removidas = getCategoriasRemovidas();
            removidas.push(valor);
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
        mesAnoParaExcluir = mesAno;
        idxParaExcluir = idx;
        modalConfirmar.style.display = 'flex';
    }
    function fecharModalConfirmarExclusao() {
        modalConfirmar.style.display = 'none';
        mesAnoParaExcluir = null;
        idxParaExcluir = null;
    }

    // Funções para o modal de categoria em uso
    function abrirModalCategoriaEmUso(nomeCategoria, quantidadeGastos) {
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
        modalCategoriaEmUso.style.display = 'none';
    }
    btnCancelarExclusao.addEventListener('click', fecharModalConfirmarExclusao);
    modalConfirmarClose.addEventListener('click', fecharModalConfirmarExclusao);
    modalConfirmar.addEventListener('click', function(e) {
        if (e.target === modalConfirmar) fecharModalConfirmarExclusao();
    });
    btnConfirmarExclusao.addEventListener('click', function() {
        if (mesAnoParaExcluir && idxParaExcluir !== null) {
            excluirGastoDoMes(mesAnoParaExcluir, idxParaExcluir, true);
            fecharModalConfirmarExclusao();
        }
    });
    // --- Fim modal confirmação ---

    // Event listeners para o modal de categoria em uso
    btnEntendiCategoria.addEventListener('click', fecharModalCategoriaEmUso);
    modalCategoriaEmUsoClose.addEventListener('click', fecharModalCategoriaEmUso);
    modalCategoriaEmUso.addEventListener('click', function(e) {
        if (e.target === modalCategoriaEmUso) {
            fecharModalCategoriaEmUso();
        }
    });

    // Atualiza tabela de gastos para o mês selecionado
    function atualizarHistoricoGastos(mesAno) {
        // Atualiza mapeamento de cores antes de renderizar histórico
        getTodasCategorias().forEach(cat => { categoriaCores[cat.valor] = cat.cor; });
        const lista = getGastosDoMesAno(mesAno);
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
            const metodosIcones = {
                'Dinheiro': '💵',
                'PIX': '📱',
                'Débito': '💳',
                'Crédito': '💳',
                'Cartão': '💳'
            };
            const iconeMetodo = metodosIcones[g.metodoPagamento] || '💰';
            const metodo = `<div class="metodo-cell">${iconeMetodo} ${g.metodoPagamento || 'Não informado'}</div>`;
            
            // Índice original na lista não-reversa
            const originalIdx = lista.length - 1 - displayIdx;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${descricao}</td><td class="valor-cell">${formatarReal(g.valor)}</td><td>${categoria}</td><td>${metodo}</td><td class="data-cell">📅 ${dataFormatada}</td><td class="action-cell"><button class='btn-delete-modern' title='Excluir gasto' data-idx='${originalIdx}'>🗑️</button></td>`;
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
        
        const listaCompleta = getGastos();
        const listaMes = getGastosDoMesAno(mesAno);
        
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
            localStorage.setItem(gastosKey, JSON.stringify(listaCompleta));
            // refresca opções e exibição mantendo o mês selecionado
            preencherSelectMesAno();
            selectMesAno.value = mesAno;
            atualizarTudoPorMes();
        } else {
            console.error('Não foi possível encontrar o gasto para exclusão');
        }
    }

    // Eventos do select
    selectMesAno.addEventListener('change', atualizarTudoPorMes);

    // Ao adicionar gasto, atualizar select e exibição
    if (formGasto) {
        formGasto.addEventListener('submit', function(e) {
            e.preventDefault();
            const descricao = document.getElementById('descricao').value.trim();
            const valorTotal = parseFloat(document.getElementById('valor').value);
            const data = document.getElementById('data').value;
            const parcelas = parseInt(document.getElementById('parcelas').value) || 1;
            const categoria = document.getElementById('categoria').value;
            if (!descricao || isNaN(valorTotal) || !data || isNaN(parcelas) || parcelas < 1 || !categoria) return;
            const lista = getGastos();
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
                lista.push({ descricao: descParcela, valor: valorAtual, data: dataParcela.toISOString().slice(0,10), categoria });
            }
            localStorage.setItem(gastosKey, JSON.stringify(lista));
            // Atualiza select de meses e seleciona o ciclo correto baseado no início do mês financeiro
            preencherSelectMesAno();
            const { year: cyYear, month: cyMonth } = getCycleKeyForDate(data);
            selectMesAno.value = `${cyYear}-${String(cyMonth).padStart(2,'0')}`;
            // Atualiza UI e gráficos para o ciclo selecionado
            atualizarTudoPorMes();
            renderCategoriaChart();
            renderMensalChart();
            formGasto.reset();
            document.getElementById('parcelas').value = 1;
        });
    }

    // Inicialização
    preencherSelectMesAno();
    selectMesAno.value = getCurrentCycleKeyStr();
    atualizarTudoPorMes();

    const navLinks = document.querySelectorAll('.nav-list a');
    const logoutLink = document.getElementById('logout-link');
    const sections = {
        'Gastos': document.getElementById('tela-gastos'),
        'Investimentos': document.getElementById('tela-investimentos'),
        'Configurações': document.getElementById('tela-configuracoes')
    };

    // Mostrar/esconder campo de método personalizado
    const selectMetodo = document.getElementById('metodo-pagamento');
    if (selectMetodo) {
        selectMetodo.addEventListener('change', function() {
            const divOutro = document.getElementById('div-outro-metodo');
            divOutro.style.display = this.value === 'Outro' ? 'block' : 'none';
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
    showSection('Gastos');

    // Ao trocar de seção, mostrar/ocultar cadastro de categoria
    function showSection(sectionName) {
        Object.values(sections).forEach(sec => sec.style.display = 'none');
        if (sections[sectionName]) {
            sections[sectionName].style.display = 'block';
        }
        if (divCadastroCategoria) {
            divCadastroCategoria.style.display = (sectionName === 'Gastos') ? 'block' : 'none';
        }
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const sectionName = link.textContent.trim();
            showSection(sectionName);
        });
    });

    // --- Sistema de abas em Gastos ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.style.display = 'none');
            this.classList.add('active');
            const target = this.dataset.tab;
            document.getElementById(target).style.display = 'block';
            // Re-render charts when showing graphs tab
            if (target === 'tab-graficos') {
                renderCategoriaChart();
                renderMensalChart();
            }
        });
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
                        renderCategoriaChart();
                    } else if (subtabId === 'subtab-mensal') {
                        renderMensalChart();
                    }
                }, 200);
                
            }, 320);
        });
    });
    // --- Inicialização de Charts Melhorados ---
    const ctxCategoria = document.getElementById('chartCategoria').getContext('2d');
    const ctxMensal = document.getElementById('chartMensal').getContext('2d');
    let chartCategoria, chartMensal;

    // Paleta de cores gradiente personalizada
    const createGradient = (ctx, color1, color2) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        return gradient;
    };

    // Cores vibrantes para categorias
    const getCategoryColor = (index) => {
        const colors = [
            { start: '#4D6619', end: '#9ACD32' },
            { start: '#FF6B6B', end: '#FF8E8E' },
            { start: '#4ECDC4', end: '#45B7B8' },
            { start: '#45B7D1', end: '#3742FA' },
            { start: '#FFA726', end: '#FFB74D' },
            { start: '#AB47BC', end: '#CE93D8' },
            { start: '#26A69A', end: '#4DB6AC' },
            { start: '#FF7043', end: '#FFAB91' }
        ];
        return colors[index % colors.length];
    };

    // Função para mostrar/esconder estado vazio
    const toggleEmptyState = (containerId, show) => {
        const container = document.querySelector(`#${containerId} .chart-container`);
        const canvas = container.querySelector('canvas');
        const emptyState = container.querySelector('.chart-empty-state');
        
        if (show) {
            canvas.style.display = 'none';
            emptyState.style.display = 'flex';
        } else {
            canvas.style.display = 'block';
            emptyState.style.display = 'none';
        }
    };

    function renderCategoriaChart() {
        const mesAno = selectMesAno.value;
        const gastos = getGastosDoMesAno(mesAno);
        const allCats = getTodasCategorias();
        const labels = [];
        const data = [];
        const backgroundColors = [];
        const borderColors = [];

        allCats.forEach((cat, index) => {
            const total = gastos.filter(g => g.categoria === cat.valor)
                                 .reduce((sum, g) => sum + parseFloat(g.valor), 0);
            if (total > 0) {
                labels.push(cat.nome);
                data.push(total);
                
                const colorScheme = getCategoryColor(index);
                backgroundColors.push(createGradient(ctxCategoria, colorScheme.start, colorScheme.end));
                borderColors.push(colorScheme.start);
            }
        });

        // Mostrar estado vazio se não há dados
        if (data.length === 0) {
            toggleEmptyState('subtab-categoria', true);
            if (chartCategoria) {
                chartCategoria.destroy();
                chartCategoria = null;
            }
            return;
        }

        toggleEmptyState('subtab-categoria', false);

        if (chartCategoria) chartCategoria.destroy();
        
        chartCategoria = new Chart(ctxCategoria, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    label: 'Gastos por categoria',
                    data,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 3,
                    hoverBorderWidth: 4,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1500,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            font: {
                                size: 14,
                                weight: '600'
                            },
                            color: '#4D6619',
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(77, 102, 25, 0.95)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#9ACD32',
                        borderWidth: 2,
                        cornerRadius: 12,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: R$ ${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                },
                elements: {
                    arc: {
                        borderWidth: 3,
                        hoverBorderWidth: 4
                    }
                }
            }
        });
    }

    function renderMensalChart() {
        const meses = getMesesAnosDisponiveis();
        
        if (meses.length === 0) {
            toggleEmptyState('subtab-mensal', true);
            if (chartMensal) {
                chartMensal.destroy();
                chartMensal = null;
            }
            return;
        }

        toggleEmptyState('subtab-mensal', false);

        const labels = meses.map(m => {
            const [ano, mes] = m.split('-');
            return new Date(ano, mes - 1)
                   .toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
        });
        
        const data = meses.map(m => getTotalGastosMes(m));
        
        // Criar gradiente para o gráfico mensal
        const gradient = createGradient(ctxMensal, '#4D6619', '#9ACD32');

        if (chartMensal) chartMensal.destroy();
        
        chartMensal = new Chart(ctxMensal, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Gastos mensais',
                    data,
                    backgroundColor: gradient,
                    borderColor: '#4D6619',
                    borderWidth: 4,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#4D6619',
                    pointBorderWidth: 3,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointHoverBackgroundColor: '#9ACD32',
                    pointHoverBorderColor: '#4D6619',
                    pointHoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 2000,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(77, 102, 25, 0.95)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#9ACD32',
                        borderWidth: 2,
                        cornerRadius: 12,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return `Gastos: R$ ${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(77, 102, 25, 0.1)',
                            borderColor: 'rgba(77, 102, 25, 0.2)'
                        },
                        ticks: {
                            color: '#4D6619',
                            font: {
                                weight: '600'
                            },
                            callback: function(value) {
                                return 'R$ ' + value.toFixed(0);
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(77, 102, 25, 0.1)',
                            borderColor: 'rgba(77, 102, 25, 0.2)'
                        },
                        ticks: {
                            color: '#4D6619',
                            font: {
                                weight: '600'
                            }
                        }
                    }
                },
                elements: {
                    line: {
                        borderJoinStyle: 'round',
                        borderCapStyle: 'round'
                    }
                }
            }
        });
    }
    // Inicializa exibição e gráficos
    document.querySelector('.tab-btn.active').click();
    document.querySelector('.tab-grafico-btn.active').click();
    renderCategoriaChart();
    renderMensalChart();
    // Atualiza gráficos ao mudar mês
    selectMesAno.addEventListener('change', () => {
        renderCategoriaChart();
        renderMensalChart();
    });

    // Configuração do dia de início do mês financeiro: inicializa campo e salva valor
    const formConfig = document.getElementById('form-config');
    const inputDiaInicioMes = document.getElementById('dia-inicio-mes');
    if (inputDiaInicioMes) {
        inputDiaInicioMes.value = getInicioMes();
    }
    if (formConfig && inputDiaInicioMes) {
        formConfig.addEventListener('submit', function(e) {
            e.preventDefault();
            const dia = parseInt(inputDiaInicioMes.value, 10);
            if (!isNaN(dia) && dia >= 1 && dia <= 28) {
                setInicioMes(dia);
                preencherSelectMesAno();
                atualizarTudoPorMes();
                renderCategoriaChart();
                renderMensalChart();
                alert('Configurações salvas com sucesso!');
            } else {
                alert('Por favor, insira um dia entre 1 e 28.');
            }
        });
    }
    
    // === FUNCIONALIDADE DOS FILTROS DO HISTÓRICO ===
    
    // Elementos dos filtros
    const searchHistorico = document.getElementById('search-historico');
    const filterCategoriaHistorico = document.getElementById('filter-categoria-historico');
    const filterMetodoHistorico = document.getElementById('filter-metodo-historico');
    const viewToggleBtns = document.querySelectorAll('.toggle-btn');
    const tableView = document.getElementById('table-view');
    const cardsView = document.getElementById('cards-view');
    
    // Variáveis de controle
    let currentView = 'table';
    let gastosOriginais = [];
    let gastosFiltrados = [];
    
    // Função para aplicar todos os filtros
    function aplicarFiltros() {
        const mesAno = selectMesAno.value;
        gastosOriginais = getGastosDoMesAno(mesAno);
        
        let gastosFiltrados = [...gastosOriginais];
        
        // Filtro de busca por descrição
        const textoBusca = searchHistorico.value.toLowerCase().trim();
        if (textoBusca) {
            gastosFiltrados = gastosFiltrados.filter(gasto => 
                gasto.descricao.toLowerCase().includes(textoBusca)
            );
        }
        
        // Filtro por categoria
        const categoriaFiltro = filterCategoriaHistorico.value;
        if (categoriaFiltro) {
            gastosFiltrados = gastosFiltrados.filter(gasto => 
                gasto.categoria === categoriaFiltro
            );
        }
        
        // Filtro por método de pagamento
        const metodoFiltro = filterMetodoHistorico.value;
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
            const metodosIcones = {
                'Dinheiro': '💵',
                'PIX': '📱',
                'Débito': '💳',
                'Crédito': '💳',
                'Cartão': '💳'
            };
            const iconeMetodo = metodosIcones[g.metodoPagamento] || '💰';
            const metodo = `<div class="metodo-cell">${iconeMetodo} ${g.metodoPagamento || 'Não informado'}</div>`;
            
            // Encontrar índice original para exclusão
            const originalIdx = gastosOriginais.findIndex(original => 
                original.descricao === g.descricao && 
                original.valor === g.valor && 
                original.data === g.data
            );
            
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${descricao}</td><td class="valor-cell">${formatarReal(g.valor)}</td><td>${categoria}</td><td>${metodo}</td><td class="data-cell">📅 ${dataFormatada}</td><td class="action-cell"><button class='btn-delete-modern' title='Excluir gasto' data-idx='${originalIdx}'>🗑️</button></td>`;
            tbody.appendChild(tr);
        });
        
        // Adiciona evento aos botões de exclusão
        document.querySelectorAll('.btn-delete-modern').forEach(btn => {
            btn.addEventListener('click', function() {
                const idx = parseInt(this.getAttribute('data-idx'));
                const mesAno = selectMesAno.value;
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
            const metodosIcones = {
                'Dinheiro': '💵',
                'PIX': '📱',
                'Débito': '💳',
                'Crédito': '💳',
                'Cartão': '💳'
            };
            const iconeMetodo = metodosIcones[g.metodoPagamento] || '💰';
            
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
                    <div class="card-valor">${formatarReal(g.valor)}</div>
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
                const mesAno = selectMesAno.value;
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
        
        totalElement.textContent = formatarReal(total);
        quantidadeElement.textContent = `${quantidade} gasto${quantidade !== 1 ? 's' : ''}`;
        mediaElement.textContent = formatarReal(media);
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

    // === ESTATÍSTICAS DO HERO ===
    
    // Função para calcular gastos de hoje
    function getGastosHoje() {
        const hoje = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
        const mesAno = getCurrentCycleKeyStr();
        const gastosDoMes = getGastosDoMesAno(mesAno);
        
        return gastosDoMes.filter(gasto => gasto.data === hoje);
    }
    
    // Função para calcular total de gastos de hoje
    function getTotalGastosHoje() {
        const gastosHoje = getGastosHoje();
        return gastosHoje.reduce((total, gasto) => total + parseFloat(gasto.valor), 0);
    }
    
    // Função para calcular quantidade de gastos de hoje
    function getQuantidadeGastosHoje() {
        return getGastosHoje().length;
    }
    
    // Função para atualizar as estatísticas do hero
    function atualizarEstatisticasHero() {
        const gastosHojeElement = document.getElementById('gastos-hoje');
        const metaMesElement = document.getElementById('meta-mes');
        
        if (gastosHojeElement) {
            const quantidadeHoje = getQuantidadeGastosHoje();
            const totalHoje = getTotalGastosHoje();
            
            if (quantidadeHoje > 0) {
                gastosHojeElement.textContent = `${quantidadeHoje} (${formatarReal(totalHoje)})`;
            } else {
                gastosHojeElement.textContent = '0';
            }
        }
        
        if (metaMesElement) {
            // Calcular sobra disponível
            const renda = getRenda();
            const totalMes = getTotalGastosMes(getCurrentCycleKeyStr());
            const sobra = renda - totalMes;
            
            if (sobra > 0) {
                metaMesElement.textContent = formatarReal(sobra);
            } else {
                metaMesElement.textContent = 'Excedido';
            }
        }
    }
    
    // === FIM ESTATÍSTICAS HERO ===
})(); // Fecha DOMContentLoaded listener
