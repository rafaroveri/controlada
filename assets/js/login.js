// login.js - Script de autenticação para tela de login

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const cadastroForm = document.getElementById('cadastro-form');
    const mostrarCadastro = document.getElementById('mostrar-cadastro');
    const voltarLogin = document.getElementById('voltar-login');

    // Alterna para o formulário de cadastro
    mostrarCadastro.addEventListener('click', function(e) {
        e.preventDefault();
        loginForm.style.display = 'none';
        cadastroForm.style.display = 'flex';
        mostrarCadastro.style.display = 'none';
    });

    // Volta para o formulário de login
    voltarLogin.addEventListener('click', function() {
        cadastroForm.style.display = 'none';
        loginForm.style.display = 'flex';
        mostrarCadastro.style.display = 'block';
    });

    const ADMIN_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

    async function hashPassword(pass) {
        const data = new TextEncoder().encode(pass);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Login
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const usuario = document.getElementById('usuario').value.trim();
        const senha = document.getElementById('senha').value;
        const usuarios = storageUtil.getJSON('usuarios', {});
        const senhaHash = await hashPassword(senha);
        if ((usuario === 'admin' && senhaHash === ADMIN_HASH) || (usuarios[usuario] && usuarios[usuario] === senhaHash)) {
            localStorage.setItem('autenticado', 'true');
            window.location.href = 'index.html';
        } else {
            alert('Usuário ou senha inválidos!');
        }
    });

    // Cadastro
    cadastroForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const novoUsuario = document.getElementById('novo-usuario').value.trim();
        const novaSenha = document.getElementById('nova-senha').value;
        if (!novoUsuario || !novaSenha) return;
        let usuarios = storageUtil.getJSON('usuarios', {});
        if (usuarios[novoUsuario] || novoUsuario === 'admin') {
            alert('Usuário já existe!');
            return;
        }
        usuarios[novoUsuario] = await hashPassword(novaSenha);
        storageUtil.setJSON('usuarios', usuarios);
        alert('Cadastro realizado com sucesso! Faça login.');
        cadastroForm.reset();
        cadastroForm.style.display = 'none';
        loginForm.style.display = 'flex';
        mostrarCadastro.style.display = 'block';
    });
});
