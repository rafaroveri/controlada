const path = require('path');
const { test, expect } = require('@playwright/test');

const rootPath = path.resolve(__dirname, '../../');
const loginUrl = `file://${path.join(rootPath, 'login.html')}`;
const indexUrl = `file://${path.join(rootPath, 'index.html')}`;

const fillInput = async (page, selector, value) => {
  await page.locator(selector).fill('');
  await page.locator(selector).fill(value);
};

test('fluxo de login e criação de gasto atualiza a sobra', async ({ page }) => {
  await page.goto(loginUrl);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('renda_usuario', '1000'));

  await page.getByRole('link', { name: 'Cadastre-se gratuitamente' }).click();

  const username = `usuario${Date.now()}`;
  const password = 'SenhaSegura123!';

  await fillInput(page, '#nome-completo', 'Usuário Playwright');
  await fillInput(page, '#email-cadastro', `${username}@teste.com`);
  await fillInput(page, '#novo-usuario', username);
  await fillInput(page, '#nova-senha', password);
  await fillInput(page, '#confirmar-senha', password);
  await fillInput(page, '#renda-base', '1000');
  await fillInput(page, '#inicio-mes', '1');

  await page.locator('#cadastro-form button[type="submit"]').click();
  await expect(page.locator('#login-feedback')).toHaveText(/Cadastro realizado com sucesso/i, { timeout: 10000 });

  await fillInput(page, '#usuario', username);
  await fillInput(page, '#senha', password);
  await page.locator('#login-form button[type="submit"]').click();
  await page.waitForURL(indexUrl, { timeout: 15000 });

  await page.waitForSelector('#form-gasto', { timeout: 15000 });
  await page.waitForSelector('#categoria option[value="alimentacao"]', { timeout: 15000 });
  await fillInput(page, '#descricao', 'Almoço automatizado');
  await fillInput(page, '#valor', '100');
  const hoje = new Date().toISOString().split('T')[0];
  await fillInput(page, '#data', hoje);
  await fillInput(page, '#parcelas', '1');
  await page.selectOption('#categoria', { value: 'alimentacao' });
  await page.selectOption('#metodo-pagamento', { value: 'Dinheiro' });
  await page.locator('#form-gasto button[type="submit"]').click();

  await expect(page.locator('#sidebar-sobra-valor')).toHaveText(/900,00/, { timeout: 10000 });
});
