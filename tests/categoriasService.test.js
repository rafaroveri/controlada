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

describe('categoriasService', () => {
  const storagePath = path.resolve(__dirname, '../assets/js/storage.js');
  const categoriasPath = path.resolve(__dirname, '../assets/js/categories.js');
  let categoriasService;

  beforeEach(() => {
    jest.resetModules();
    ensureLocalStorage();
    localStorage.clear();
    global.storageUtil = require(storagePath);
    categoriasService = require(categoriasPath);
  });

  test('createCategoria gera ids e valor normalizado', () => {
    const categoria = categoriasService.createCategoria({ nome: 'Viagem Premium', cor: '#ff00aa' });
    expect(categoria.id).toBeDefined();
    expect(categoria.valor).toBe('viagem-premium');
    const armazenadas = categoriasService.getPersonalizadas();
    expect(armazenadas).toHaveLength(1);
    expect(armazenadas[0]).toMatchObject({ nome: 'Viagem Premium', cor: '#ff00aa' });
  });

  test('archiveCategoria remove item e adiciona à lista de removidas', () => {
    const categoria = categoriasService.createCategoria({ nome: 'Cursos' });
    categoriasService.archiveCategoria(categoria.id);
    expect(categoriasService.getPersonalizadas()).toHaveLength(0);
    const removidas = categoriasService.getRemovidas();
    expect(removidas.some(item => item.id === categoria.id)).toBe(true);
    expect(categoriasService.getTodas().some(cat => cat.id === categoria.id)).toBe(false);
  });

  test('restoreCategoria remove id da lista de removidas', () => {
    const categoria = categoriasService.createCategoria({ nome: 'Saúde extra' });
    categoriasService.archiveCategoria(categoria.id);
    categoriasService.restoreCategoria(categoria.id);
    expect(categoriasService.getRemovidas()).not.toContain(categoria.id);
  });
});
