(function(global){
    const PAYMENT_METHOD_ICONS = {
        'Dinheiro': '💵',
        'PIX': '📱',
        'Débito': '💳',
        'Crédito': '💳',
        'Cartão': '💳',
        'Outro': '💰'
    };

    const Constants = {
        PAYMENT_METHOD_ICONS,
        DEFAULT_PAYMENT_ICON: '💰'
    };

    if(typeof module !== 'undefined' && module.exports){
        module.exports = Constants;
    }

    global.appConstants = Constants;
})(typeof window !== 'undefined' ? window : globalThis);
