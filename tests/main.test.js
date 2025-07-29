const mainModule = require('../assets/js/main.js');

describe('getCycleKeyForDate', () => {
  beforeEach(() => {
    localStorage.clear();
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  test('returns same month when day >= start day', () => {
    localStorage.setItem('config_inicio_mes', '5');
    const { year, month } = mainModule.getCycleKeyForDate('2023-03-06');
    expect(year).toBe(2023);
    expect(month).toBe(3);
  });

  test('returns previous month when day < start day', () => {
    localStorage.setItem('config_inicio_mes', '10');
    const { year, month } = mainModule.getCycleKeyForDate(new Date('2023-03-05'));
    expect(year).toBe(2023);
    expect(month).toBe(2);
  });
});

describe('getTotalGastosMes', () => {
  beforeEach(() => {
    localStorage.clear();
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  test('sums gastos for given month', () => {
    localStorage.setItem('gastos_usuario', JSON.stringify([
      { valor: '10', data: '2023-05-05' },
      { valor: '15', data: '2023-05-20' },
      { valor: '5',  data: '2023-06-01' }
    ]));

    const total = mainModule.getTotalGastosMes('2023-05');
    expect(total).toBe(25);
  });
});
