(function(global, factory){
    if(typeof module !== 'undefined' && module.exports){
        const dataService = require('./data-service');
        module.exports = factory(global, dataService);
    } else {
        global.chartsManager = factory(global, global.dataService);
    }
})(typeof window !== 'undefined' ? window : globalThis, function(global, dataService){
    if(!dataService){
        throw new Error('dataService é obrigatório para chartsManager.');
    }

    let selectMesAnoRef = null;
    let categoriaCanvasRef = null;
    let mensalCanvasRef = null;
    let metodosCanvasRef = null;
    let categoriaTableRef = null;
    let mensalTableRef = null;
    let metodosTableRef = null;
    let chartCategoria = null;
    let chartMensal = null;
    let chartMetodos = null;
    let chartJsPromise = null;

    const categoryColors = [
        { start: '#4D6619', end: '#9ACD32' },
        { start: '#FF6B6B', end: '#FF8E8E' },
        { start: '#4ECDC4', end: '#45B7B8' },
        { start: '#45B7D1', end: '#3742FA' },
        { start: '#FFA726', end: '#FFB74D' },
        { start: '#AB47BC', end: '#CE93D8' },
        { start: '#26A69A', end: '#4DB6AC' },
        { start: '#FF7043', end: '#FFAB91' }
    ];

    const STATUS_PENDENTE = 'pendente';
    const filtrarEfetivados = lista => (lista || []).filter(item => item.status !== STATUS_PENDENTE);

    function createGradient(ctx, color1, color2){
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        return gradient;
    }

    function toggleEmptyState(containerId, show){
        const container = global.document ? global.document.querySelector(`#${containerId} .chart-container`) : null;
        if(!container) return;
        const canvas = container.querySelector('canvas');
        const emptyState = container.querySelector('.chart-empty-state');
        if(show){
            if(canvas) canvas.style.display = 'none';
            if(emptyState) emptyState.style.display = 'flex';
        } else {
            if(canvas) canvas.style.display = 'block';
            if(emptyState) emptyState.style.display = 'none';
        }
    }

    function ensureChartJs(){
        if(global.Chart){
            return Promise.resolve(global.Chart);
        }
        if(chartJsPromise){
            return chartJsPromise;
        }
        if(!global.document){
            return Promise.resolve(null);
        }
        chartJsPromise = new Promise((resolve, reject) => {
            const handleError = () => {
                chartJsPromise = null;
                reject(new Error('Falha ao carregar Chart.js.'));
            };
            const existing = global.document.querySelector('script[data-chartjs]');
            if(existing){
                existing.addEventListener('load', () => resolve(global.Chart));
                existing.addEventListener('error', handleError);
                return;
            }
            const script = global.document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.async = true;
            script.defer = true;
            script.setAttribute('data-chartjs', 'true');
            script.addEventListener('load', () => resolve(global.Chart));
            script.addEventListener('error', handleError);
            global.document.head.appendChild(script);
        });
        return chartJsPromise;
    }

    function isCanvasVisible(canvas){
        return !!(canvas && canvas.offsetParent !== null);
    }

    function formatMesAnoLabel(cycleKey){
        if(!cycleKey) return '';
        const [ano, mes] = cycleKey.split('-');
        if(!ano || !mes){
            return '';
        }
        const date = new Date(Number(ano), Number(mes) - 1);
        if(Number.isNaN(date.getTime())){
            return '';
        }
        return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    }

    const escapeHtml = value => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    function updateDataTable(table, headers, rows, { emptyMessage = 'Sem dados disponíveis.', captionSuffix = '' } = {}){
        if(!table || !global.document){
            return;
        }
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        if(thead){
            thead.innerHTML = `<tr>${headers.map(header => `<th scope="col">${escapeHtml(header)}</th>`).join('')}</tr>`;
        }
        if(tbody){
            if(!rows.length){
                tbody.innerHTML = `<tr><td colspan="${headers.length}">${escapeHtml(emptyMessage)}</td></tr>`;
            } else {
                tbody.innerHTML = rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
            }
        }
        const caption = table.querySelector('caption');
        if(caption){
            const base = table.dataset.baseCaption || caption.textContent || '';
            if(!table.dataset.baseCaption){
                table.dataset.baseCaption = base;
            }
            caption.textContent = captionSuffix ? `${base} - ${captionSuffix}` : base;
        }
    }

    function getSelectedMesAno(){
        if(selectMesAnoRef && selectMesAnoRef.value){
            return selectMesAnoRef.value;
        }
        return dataService.getCurrentCycleKeyStr();
    }

    function init(options = {}){
        selectMesAnoRef = options.selectMesAno || selectMesAnoRef;
        categoriaCanvasRef = options.categoriaCanvas || categoriaCanvasRef;
        mensalCanvasRef = options.mensalCanvas || mensalCanvasRef;
        metodosCanvasRef = options.metodosCanvas || metodosCanvasRef;
        categoriaTableRef = options.categoriaTable || categoriaTableRef;
        mensalTableRef = options.mensalTable || mensalTableRef;
        metodosTableRef = options.metodosTable || metodosTableRef;

        [categoriaTableRef, mensalTableRef, metodosTableRef].forEach(table => {
            if(table && table.querySelector && !table.dataset.baseCaption){
                const caption = table.querySelector('caption');
                if(caption){
                    table.dataset.baseCaption = caption.textContent || '';
                }
            }
        });
    }

    function destroyChart(instance){
        if(instance){
            instance.destroy();
        }
        return null;
    }

    function renderCategoriaChart(){
        const mesAno = getSelectedMesAno();
        const gastos = filtrarEfetivados(dataService.getGastosDoMesAno(mesAno));
        const categorias = dataService.getTodasCategorias();
        const ctx = categoriaCanvasRef ? categoriaCanvasRef.getContext('2d') : null;

        const labels = [];
        const valores = [];
        const backgrounds = [];
        const borders = [];

        categorias.forEach((categoria, index) => {
            const total = gastos
                .filter(gasto => gasto.categoria === categoria.valor)
                .reduce((soma, gasto) => soma + parseFloat(gasto.valor || 0), 0);
            if(total > 0){
                labels.push(categoria.nome);
                valores.push(total);
                const colorScheme = categoryColors[index % categoryColors.length];
                if(ctx){
                    backgrounds.push(createGradient(ctx, colorScheme.start, colorScheme.end));
                } else {
                    backgrounds.push(colorScheme.start);
                }
                borders.push(colorScheme.start);
            }
        });

        const captionSuffix = formatMesAnoLabel(mesAno);
        const tableRows = labels.map((label, index) => [label, dataService.formatCurrency(valores[index])]);
        updateDataTable(categoriaTableRef, ['Categoria', 'Total'], tableRows, {
            emptyMessage: 'Nenhum gasto encontrado para este período.',
            captionSuffix
        });

        if(valores.length === 0){
            toggleEmptyState('subtab-categoria', true);
            chartCategoria = destroyChart(chartCategoria);
            return Promise.resolve(null);
        }

        toggleEmptyState('subtab-categoria', false);

        if(chartCategoria){
            chartCategoria.data.labels = labels;
            chartCategoria.data.datasets[0].data = valores;
            if(backgrounds.length){
                chartCategoria.data.datasets[0].backgroundColor = backgrounds;
                chartCategoria.data.datasets[0].borderColor = borders;
            }
            chartCategoria.update();
            return Promise.resolve(chartCategoria);
        }

        if(!categoriaCanvasRef || !isCanvasVisible(categoriaCanvasRef)){
            return Promise.resolve(null);
        }

        const buildChart = () => {
            const chartContext = categoriaCanvasRef.getContext('2d');
            const datasetBackground = backgrounds.length ? backgrounds : labels.map((_, index) => {
                const scheme = categoryColors[index % categoryColors.length];
                return createGradient(chartContext, scheme.start, scheme.end);
            });
            const datasetBorder = borders.length ? borders : labels.map((_, index) => {
                const scheme = categoryColors[index % categoryColors.length];
                return scheme.start;
            });
            chartCategoria = new global.Chart(chartContext, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        label: 'Gastos por categoria',
                        data: valores,
                        backgroundColor: datasetBackground,
                        borderColor: datasetBorder,
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
                                label: function(context){
                                    const valor = context.parsed;
                                    const total = context.dataset.data.reduce((acc, atual) => acc + atual, 0);
                                    const percentual = total > 0 ? ((valor / total) * 100).toFixed(1) : '0.0';
                                    return `${context.label}: ${dataService.formatCurrency(valor)} (${percentual}%)`;
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
            return chartCategoria;
        };

        if(global.Chart){
            return Promise.resolve(buildChart());
        }

        return ensureChartJs().then(buildChart).catch(() => null);
    }

    function renderMensalChart(){
        const meses = dataService.getMesesAnosDisponiveis();
        const labels = meses.map(mesAno => {
            const [ano, mes] = mesAno.split('-');
            const date = new Date(ano, mes - 1);
            return date.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
        });
        const dados = meses.map(mesAno => dataService.getTotalGastosMes(mesAno));

        const tableRows = meses.map((mesAno, index) => {
            const [ano, mes] = mesAno.split('-');
            const date = new Date(ano, mes - 1);
            const monthLabel = date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
            const capitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
            return [capitalized, dataService.formatCurrency(dados[index])];
        });
        updateDataTable(mensalTableRef, ['Mês', 'Total de gastos'], tableRows, {
            emptyMessage: 'Sem histórico disponível.'
        });

        if(meses.length === 0){
            toggleEmptyState('subtab-mensal', true);
            chartMensal = destroyChart(chartMensal);
            return Promise.resolve(null);
        }

        toggleEmptyState('subtab-mensal', false);

        const ctx = mensalCanvasRef ? mensalCanvasRef.getContext('2d') : null;
        const gradient = ctx ? createGradient(ctx, '#4D6619', '#9ACD32') : '#4D6619';

        if(chartMensal){
            chartMensal.data.labels = labels;
            chartMensal.data.datasets[0].data = dados;
            if(ctx){
                chartMensal.data.datasets[0].backgroundColor = gradient;
            }
            chartMensal.update();
            return Promise.resolve(chartMensal);
        }

        if(!mensalCanvasRef || !isCanvasVisible(mensalCanvasRef)){
            return Promise.resolve(null);
        }

        const createChart = () => {
            const chartContext = mensalCanvasRef.getContext('2d');
            const fillGradient = createGradient(chartContext, '#4D6619', '#9ACD32');
            chartMensal = new global.Chart(chartContext, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Gastos mensais',
                        data: dados,
                        backgroundColor: fillGradient,
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
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(77, 102, 25, 0.95)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#9ACD32',
                            borderWidth: 2,
                            cornerRadius: 12,
                            padding: 12,
                            callbacks: {
                                label: function(context){
                                    return `${context.label}: ${dataService.formatCurrency(context.parsed.y)}`;
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
                                callback: function(value){
                                    return `R$ ${Number(value).toFixed(0)}`;
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
            return chartMensal;
        };

        if(global.Chart){
            return Promise.resolve(createChart());
        }

        return ensureChartJs().then(createChart).catch(() => null);
    }

    function renderMetodosChart(){
        const mesAno = getSelectedMesAno();
        const distribuicao = dataService.getDistribuicaoMetodosPagamento(mesAno);
        const labels = Object.keys(distribuicao.valores);
        const dataset = labels.map(label => {
            const percentual = distribuicao.percentuais[label];
            return Number.isFinite(percentual) ? percentual : 0;
        });
        const tableRows = labels.map(label => [
            label,
            dataService.formatCurrency(distribuicao.valores[label] || 0),
            `${(distribuicao.percentuais[label] || 0).toFixed(1)}%`
        ]);
        updateDataTable(metodosTableRef, ['Método', 'Valor', 'Participação'], tableRows, {
            emptyMessage: 'Nenhum pagamento registrado para este período.',
            captionSuffix: formatMesAnoLabel(mesAno)
        });

        if(labels.length === 0){
            chartMetodos = destroyChart(chartMetodos);
            if(metodosCanvasRef){
                metodosCanvasRef.style.display = 'none';
            }
            return Promise.resolve(null);
        }

        if(metodosCanvasRef){
            metodosCanvasRef.style.display = '';
        }

        const colors = [
            'rgba(154, 205, 50, 0.8)',
            'rgba(77, 102, 25, 0.8)',
            'rgba(178, 190, 181, 0.8)',
            'rgba(154, 205, 50, 0.6)',
            'rgba(77, 102, 25, 0.6)'
        ];

        if(chartMetodos){
            chartMetodos.data.labels = labels;
            chartMetodos.data.datasets[0].data = dataset;
            chartMetodos.update();
            return Promise.resolve(chartMetodos);
        }

        if(!metodosCanvasRef || !isCanvasVisible(metodosCanvasRef)){
            return Promise.resolve(null);
        }

        const createChart = () => {
            chartMetodos = new global.Chart(metodosCanvasRef, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data: dataset,
                        backgroundColor: colors.slice(0, labels.length),
                        borderColor: 'rgba(255, 255, 255, 0.8)',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                padding: 15,
                                font: { size: 11 }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context){
                                    const metodo = context.label || '';
                                    const valor = dataService.formatCurrency(distribuicao.valores[metodo] || 0);
                                    const percentual = (distribuicao.percentuais[metodo] || 0).toFixed(1);
                                    return `${metodo}: ${valor} (${percentual}%)`;
                                }
                            }
                        }
                    }
                }
            });
            return chartMetodos;
        };

        if(global.Chart){
            return Promise.resolve(createChart());
        }

        return ensureChartJs().then(createChart).catch(() => null);
    }

    function refreshAll(){
        return Promise.all([
            renderCategoriaChart(),
            renderMensalChart(),
            renderMetodosChart()
        ]);
    }

    return {
        init,
        renderCategoriaChart,
        renderMensalChart,
        renderMetodosChart,
        refreshAll
    };
});
