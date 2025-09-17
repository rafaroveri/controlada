// main.js - ponto de entrada da aplicação
(function(window, factory){
    if(typeof module !== 'undefined' && module.exports){
        const dataService = require('./data-service');
        const uiManager = require('./ui');
        module.exports = factory(window, dataService, uiManager, true);
    } else {
        factory(window, window.dataService, window.uiManager, false);
    }
})(typeof window !== 'undefined' ? window : globalThis, function(window, dataService, uiManager, isModule){
    if(typeof window.localStorage === 'undefined'){
        let storage = {};
        window.localStorage = {
            getItem(key){
                return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
            },
            setItem(key, value){
                storage[key] = String(value);
            },
            removeItem(key){
                delete storage[key];
            },
            clear(){
                storage = {};
            }
        };
    }

    if(typeof window.Event === 'undefined'){
        window.Event = function(type){ this.type = type; };
    }

    function createStubElement(){
        const stub = {
            style: {},
            dataset: {},
            innerHTML: '',
            value: '',
            classList: {
                add(){},
                remove(){},
                toggle(){},
                contains(){ return false; }
            },
            setAttribute(){},
            appendChild(){},
            removeChild(){},
            addEventListener(){},
            removeEventListener(){},
            querySelector(){ return null; },
            querySelectorAll(){ return []; },
            focus(){},
            click(){},
            getContext(){ return { canvas: stub, createLinearGradient(){ return { addColorStop(){} }; } }; }
        };
        return stub;
    }

    if(!window.document){
        const listeners = {};
        window.document = {
            addEventListener(type, callback){
                listeners[type] = listeners[type] || [];
                listeners[type].push(callback);
            },
            removeEventListener(type, callback){
                if(!listeners[type]) return;
                listeners[type] = listeners[type].filter(cb => cb !== callback);
            },
            dispatchEvent(event){
                const queue = listeners[event.type] || [];
                queue.forEach(cb => {
                    try { cb(event); } catch (error) { /* ignore in tests */ }
                });
            },
            getElementById(){ return null; },
            querySelector(){ return createStubElement(); },
            querySelectorAll(){ return []; },
            createElement(){ return createStubElement(); },
            body: {
                setAttribute(){},
                classList: {
                    add(){},
                    remove(){},
                    toggle(){},
                    contains(){ return false; }
                }
            }
        };
    }

    function initializeUI(){
        if(uiManager && typeof uiManager.init === 'function'){
            uiManager.init();
        }
    }

    if(window.document){
        window.document.addEventListener('DOMContentLoaded', initializeUI);
    }

    if(isModule){
        return {
            getCycleKeyForDate: dataService.getCycleKeyForDate,
            getTotalGastosMes: dataService.getTotalGastosMes
        };
    }
});
