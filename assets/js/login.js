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

    // Login
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const usuario = document.getElementById('usuario').value.trim();
        const senha = document.getElementById('senha').value;
        // Busca usuários cadastrados
        const usuarios = JSON.parse(localStorage.getItem('usuarios') || '{}');
        if ((usuario === 'admin' && senha === '1234') || (usuarios[usuario] && usuarios[usuario] === senha)) {
            localStorage.setItem('autenticado', 'true');
            window.location.href = 'index.html';
        } else {
            alert('Usuário ou senha inválidos!');
        }
    });

    // Cadastro
    cadastroForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const novoUsuario = document.getElementById('novo-usuario').value.trim();
        const novaSenha = document.getElementById('nova-senha').value;
        if (!novoUsuario || !novaSenha) return;
        let usuarios = JSON.parse(localStorage.getItem('usuarios') || '{}');
        if (usuarios[novoUsuario] || novoUsuario === 'admin') {
            alert('Usuário já existe!');
            return;
        }
        usuarios[novoUsuario] = novaSenha;
        localStorage.setItem('usuarios', JSON.stringify(usuarios));
        alert('Cadastro realizado com sucesso! Faça login.');
        cadastroForm.reset();
        cadastroForm.style.display = 'none';
        loginForm.style.display = 'flex';
        mostrarCadastro.style.display = 'block';
    });
});
