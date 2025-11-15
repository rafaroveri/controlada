const path = require('path');

function ensureLocalStorage(){
  if(typeof global.localStorage !== 'undefined'){
    return;
  }
  let store = {};
  global.localStorage = {
    getItem: key => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: key => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
}

describe('storageUtil', () => {
  const storagePath = path.resolve(__dirname, '../assets/js/storage.js');
  let storageUtil;

  const loadModule = () => {
    jest.resetModules();
    storageUtil = require(storagePath);
  };

  beforeEach(() => {
    ensureLocalStorage();
    localStorage.clear();
    delete global.backendService;
    jest.resetModules();
    loadModule();
  });

  test('getNumber returns numeric value and clears invalid data', () => {
    localStorage.setItem('saldo', '42.5');
    expect(storageUtil.getNumber('saldo')).toBe(42.5);

    localStorage.setItem('saldo', 'invalid');
    expect(storageUtil.getNumber('saldo')).toBe(0);
    expect(localStorage.getItem('saldo')).toBeNull();
  });

  test('getJSON returns default when payload is inválido', () => {
    localStorage.setItem('metas', '{not-json');
    const resultado = storageUtil.getJSON('metas', { foo: 'bar' });
    expect(resultado).toEqual({ foo: 'bar' });
    expect(localStorage.getItem('metas')).toBeNull();
  });

  test('appendToList cria lista segura mesmo com dados malformados', () => {
    localStorage.setItem('gastos', '"texto solto"');
    const item = { descricao: 'Teste', valor: 10 };
    const lista = storageUtil.appendToList('gastos', item);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toEqual(item);
    expect(JSON.parse(localStorage.getItem('gastos'))).toHaveLength(1);
  });

  test('operações disparam sincronização quando backend está disponível', () => {
    const persistKey = jest.fn(() => Promise.resolve());
    global.backendService = { persistKey };
    loadModule();

    storageUtil.setJSON('metas', { janeiro: 100 });
    storageUtil.setNumber('renda', 500);
    storageUtil.remove('metas');

    expect(persistKey).toHaveBeenCalledWith('metas', { janeiro: 100 });
    expect(persistKey).toHaveBeenCalledWith('renda', 500);
    expect(persistKey).toHaveBeenCalledWith('metas', null);
  });
});
