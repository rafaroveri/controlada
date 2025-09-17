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
    let chartCategoria = null;
    let chartMensal = null;
    let chartMetodos = null;

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
    }

    function destroyChart(instance){
        if(instance){
            instance.destroy();
        }
        return null;
    }

    function renderCategoriaChart(){
        if(!categoriaCanvasRef || !global.Chart) return;
        const ctx = categoriaCanvasRef.getContext('2d');
        const mesAno = getSelectedMesAno();
        const gastos = dataService.getGastosDoMesAno(mesAno);
        const categorias = dataService.getTodasCategorias();

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
                backgrounds.push(createGradient(ctx, colorScheme.start, colorScheme.end));
                borders.push(colorScheme.start);
            }
        });

        if(valores.length === 0){
            toggleEmptyState('subtab-categoria', true);
            chartCategoria = destroyChart(chartCategoria);
            return;
        }

        toggleEmptyState('subtab-categoria', false);
        chartCategoria = destroyChart(chartCategoria);

        chartCategoria = new global.Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    label: 'Gastos por categoria',
                    data: valores,
                    backgroundColor: backgrounds,
                    borderColor: borders,
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
    }

    function renderMensalChart(){
        if(!mensalCanvasRef || !global.Chart) return;
        const ctx = mensalCanvasRef.getContext('2d');
        const meses = dataService.getMesesAnosDisponiveis();

        if(meses.length === 0){
            toggleEmptyState('subtab-mensal', true);
            chartMensal = destroyChart(chartMensal);
            return;
        }

        toggleEmptyState('subtab-mensal', false);

        const labels = meses.map(mesAno => {
            const [ano, mes] = mesAno.split('-');
            const date = new Date(ano, mes - 1);
            return date.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
        });

        const dados = meses.map(mesAno => dataService.getTotalGastosMes(mesAno));
        const gradient = createGradient(ctx, '#4D6619', '#9ACD32');

        chartMensal = destroyChart(chartMensal);

        chartMensal = new global.Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Gastos mensais',
                    data: dados,
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
                                return `Gastos: ${dataService.formatCurrency(context.parsed.y)}`;
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
    }

    function renderMetodosChart(){
        if(!metodosCanvasRef || !global.Chart) return;
        const distribuicao = dataService.getDistribuicaoMetodosPagamento();
        const labels = Object.keys(distribuicao.valores);
        const values = Object.values(distribuicao.percentuais);
        const colors = [
            'rgba(154, 205, 50, 0.8)',
            'rgba(77, 102, 25, 0.8)',
            'rgba(178, 190, 181, 0.8)',
            'rgba(154, 205, 50, 0.6)',
            'rgba(77, 102, 25, 0.6)'
        ];

        chartMetodos = destroyChart(chartMetodos);

        chartMetodos = new global.Chart(metodosCanvasRef, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
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
                    }
                }
            }
        });
    }

    function refreshAll(){
        renderCategoriaChart();
        renderMensalChart();
        renderMetodosChart();
    }

    return {
        init,
        renderCategoriaChart,
        renderMensalChart,
        renderMetodosChart,
        refreshAll
    };
});
