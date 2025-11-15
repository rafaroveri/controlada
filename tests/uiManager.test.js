const createStubElement = () => ({
  textContent: '',
  innerHTML: '',
  value: '',
  dataset: {},
  style: {},
  classList: {
    add: jest.fn(),
    remove: jest.fn(),
    toggle: jest.fn(),
    contains: jest.fn(),
  },
  appendChild: jest.fn(),
  removeChild: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  setAttribute: jest.fn(),
  getAttribute: jest.fn(),
  querySelector: jest.fn(() => null),
  querySelectorAll: jest.fn(() => []),
  focus: jest.fn(),
  blur: jest.fn(),
  closest: jest.fn(() => null),
});

const mockDataService = {
  formatCurrency: jest.fn(value => `R$ ${(Number(value) || 0).toFixed(2)}`),
  getRendaDetalhada: jest.fn(() => ({ base: 1000, beneficios: [], totalBeneficios: 0, total: 1000 })),
  getBenefitCards: jest.fn(() => []),
  getRenda: jest.fn(() => 1000),
  getTotalBeneficios: jest.fn(() => 0),
  getCategoriasPersonalizadas: jest.fn(() => []),
  setCategoriasPersonalizadas: jest.fn(),
  getCategoriasRemovidas: jest.fn(() => []),
  setCategoriasRemovidas: jest.fn(),
  getTodasCategorias: jest.fn(() => [{ id: 'alimentacao', nome: 'Alimentação', valor: 'alimentacao', cor: '#ffb347' }]),
  generateCategoriaId: jest.fn(() => 'cat-personalizada'),
  getGastos: jest.fn(() => []),
  setGastos: jest.fn(),
  getCurrentCycleKeyStr: jest.fn(() => '2024-01'),
  getMetasAtivas: jest.fn(() => []),
  getMetasConcluidas: jest.fn(() => []),
  getRecorrentesPendentes: jest.fn(() => []),
  updateRecorrente: jest.fn(),
  deleteRecorrente: jest.fn(),
  addBenefitCard: jest.fn(),
  setBenefitCards: jest.fn(),
  removeBenefitCard: jest.fn(),
  getTotalGastosMes: jest.fn(() => 0),
  saveMeta: jest.fn(),
  getMetas: jest.fn(() => []),
};

jest.mock('../assets/js/data-service.js', () => mockDataService);
jest.mock('../assets/js/charts.js', () => ({ refreshAll: jest.fn() }));
jest.mock('../assets/js/constants.js', () => ({ PAYMENT_METHOD_ICONS: {}, DEFAULT_PAYMENT_ICON: '💰' }));

function ensureDomGlobals(){
  if(typeof globalThis.window === 'undefined'){
    globalThis.window = globalThis;
  }
  if(typeof globalThis.document === 'undefined'){
    globalThis.document = {};
  }
}

function ensureLocalStorage(){
  if(typeof global.localStorage === 'undefined'){
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
  ensureDomGlobals();
  globalThis.window = globalThis;
  globalThis.window.localStorage = global.localStorage;
}

describe('uiManager.init', () => {
  let uiManager;

  const setupDom = () => {
    ensureDomGlobals();
    const doc = global.document;
    doc.body = createStubElement();
    doc.documentElement = createStubElement();
    doc.getElementById = jest.fn(() => createStubElement());
    doc.querySelector = jest.fn(() => createStubElement());
    doc.querySelectorAll = jest.fn(() => []);
    doc.createElement = jest.fn(() => createStubElement());
    doc.createDocumentFragment = jest.fn(() => ({ appendChild: jest.fn(), childNodes: [] }));
    doc.addEventListener = jest.fn();
    doc.removeEventListener = jest.fn();
  };

  const loadModule = () => {
    jest.isolateModules(() => {
      uiManager = require('../assets/js/ui.js');
    });
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    ensureLocalStorage();
    localStorage.clear();
    setupDom();
    delete globalThis.backendService;
    delete globalThis.firebaseService;
    globalThis.matchMedia = jest.fn(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }));
    globalThis.location = { href: 'https://app.controlada.com/index.html', hostname: 'app.controlada.com' };
    loadModule();
  });

  test('redireciona para login quando usuário local não está autenticado', () => {
    uiManager.init();
    expect(globalThis.location.href).toContain('login.html');
  });

  test('mantém usuário no dashboard quando autenticação remota é bem-sucedida', async () => {
    const ensureAuthenticated = jest.fn(() => Promise.resolve());
    globalThis.backendService = { isRemoteAvailable: true, ensureAuthenticated };
    loadModule();
    uiManager.init();
    await Promise.resolve();
    expect(ensureAuthenticated).toHaveBeenCalled();
    expect(globalThis.location.href).toBe('https://app.controlada.com/index.html');
  });
});
