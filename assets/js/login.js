// login.js - Autenticação utilizando API própria (com fallback local)

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const cadastroForm = document.getElementById('cadastro-form');
    const mostrarCadastro = document.getElementById('mostrar-cadastro');
    const voltarLogin = document.getElementById('voltar-login');
    const backendService = window.backendService || window.firebaseService;
    const hasRemote = backendService && backendService.isRemoteAvailable;
    const loginFeedback = document.getElementById('login-feedback');
    const cadastroFeedback = document.getElementById('cadastro-feedback');

    function clearFeedback(target){
        if(!target){
            return;
        }
        target.textContent = '';
        target.hidden = true;
        target.classList.remove('is-error', 'is-success');
    }

    function showFeedback(target, message, type = 'error'){
        if(!target){
            return;
        }
        target.hidden = false;
        target.textContent = message;
        target.classList.remove('is-error', 'is-success');
        target.classList.add(type === 'success' ? 'is-success' : 'is-error');
    }

    function toggleCadastro(exibir){
        if(exibir){
            loginForm.style.display = 'none';
            cadastroForm.style.display = 'flex';
            mostrarCadastro.style.display = 'none';
            clearFeedback(loginFeedback);
            clearFeedback(cadastroFeedback);
        } else {
            cadastroForm.style.display = 'none';
            loginForm.style.display = 'flex';
            mostrarCadastro.style.display = 'block';
            clearFeedback(cadastroFeedback);
        }
    }

    if(mostrarCadastro){
        mostrarCadastro.addEventListener('click', function(e){
            e.preventDefault();
            toggleCadastro(true);
        });
    }

    if(voltarLogin){
        voltarLogin.addEventListener('click', function(){
            toggleCadastro(false);
        });
    }

    function setLoading(button, loading){
        if(!button) return;
        if(!button.dataset.originalText){
            button.dataset.originalText = button.textContent;
        }
        button.disabled = loading;
        button.textContent = loading ? 'Aguarde...' : button.dataset.originalText;
    }

    function mapApiError(error){
        if(!error){
            return 'Ocorreu um erro inesperado. Tente novamente.';
        }
        const code = error.code || error.status || '';
        if(code === 'NOT_AUTHENTICATED' || code === 401){
            return 'Sessão expirada. Faça login novamente.';
        }
        if(code === 'NETWORK_ERROR'){
            return 'Não foi possível comunicar com o servidor. Verifique sua conexão.';
        }
        if(code === 409 || code === 'USERNAME_TAKEN'){
            return 'Nome de usuário já está em uso.';
        }
        if(code === 422 || code === 'VALIDATION_ERROR'){
            return error.message || 'Dados inválidos. Verifique as informações enviadas.';
        }
        return error.message || 'Não foi possível completar a operação.';
    }

    const ADMIN_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

    async function hashPassword(pass){
        const data = new TextEncoder().encode(pass);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function handleLocalLogin(usuario, senha){
        return hashPassword(senha).then(senhaHash => {
            const usuarios = storageUtil.getJSON('usuarios', {});
            if((usuario === 'admin' && senhaHash === ADMIN_HASH) || (usuarios[usuario] && usuarios[usuario] === senhaHash)){
                localStorage.setItem('autenticado', 'true');
                window.location.href = 'index.html';
                return true;
            }
            throw new Error('Usuário ou senha inválidos!');
        });
    }

    function handleLocalRegister(dados){
        return hashPassword(dados.password).then(async senhaHash => {
            const usuarios = storageUtil.getJSON('usuarios', {});
            if(usuarios[dados.username] || dados.username === 'admin'){
                throw new Error('Usuário já existe!');
            }
            usuarios[dados.username] = senhaHash;
            storageUtil.setJSON('usuarios', usuarios);

            const perfis = storageUtil.getJSON('usuarios_perfis', {});
            perfis[dados.username] = {
                nomeCompleto: dados.fullName,
                email: dados.email,
                telefone: dados.phone,
                rendaBase: dados.rendaBase,
                inicioMes: dados.inicioMes,
                temaPreferido: dados.themePreference
            };
            storageUtil.setJSON('usuarios_perfis', perfis);
        });
    }

    if(loginForm){
        loginForm.addEventListener('submit', async function(e){
            e.preventDefault();
            const usuario = document.getElementById('usuario').value.trim();
            const senha = document.getElementById('senha').value;
            const submitButton = loginForm.querySelector('button[type="submit"]');

            clearFeedback(loginFeedback);

            if(!usuario || !senha){
                showFeedback(loginFeedback, 'Informe usuário e senha para continuar.');
                return;
            }

            setLoading(submitButton, true);
            try {
                if(hasRemote){
                    await backendService.loginWithUsername(usuario, senha);
                    await backendService.loadUserDataToLocalCache(true);
                    window.location.href = 'index.html';
                } else {
                    await handleLocalLogin(usuario, senha);
                }
            } catch (error) {
                console.error('Erro ao efetuar login', error);
                const message = hasRemote ? mapApiError(error) : (error.message || 'Não foi possível efetuar login.');
                showFeedback(loginFeedback, message);
            } finally {
                setLoading(submitButton, false);
            }
        });
    }

    if(cadastroForm){
        cadastroForm.addEventListener('submit', async function(e){
            e.preventDefault();
            const fullName = document.getElementById('nome-completo').value.trim();
            const email = document.getElementById('email-cadastro').value.trim();
            const phone = document.getElementById('telefone-cadastro').value.trim();
            const username = document.getElementById('novo-usuario').value.trim();
            const password = document.getElementById('nova-senha').value;
            const confirmPassword = document.getElementById('confirmar-senha').value;
            const rendaBase = parseFloat(document.getElementById('renda-base').value || '0');
            const inicioMes = parseInt(document.getElementById('inicio-mes').value || '1', 10);
            const themePreference = document.getElementById('tema-preferido').value || 'light';
            const submitButton = cadastroForm.querySelector('button[type="submit"]');

            clearFeedback(cadastroFeedback);

            if(!fullName || !email || !username || !password){
                showFeedback(cadastroFeedback, 'Preencha todos os campos obrigatórios.');
                return;
            }

            if(password !== confirmPassword){
                showFeedback(cadastroFeedback, 'As senhas não coincidem.');
                return;
            }

            if(password.length < 6){
                showFeedback(cadastroFeedback, 'A senha deve ter pelo menos 6 caracteres.');
                return;
            }

            setLoading(submitButton, true);

            const dados = {
                username,
                password,
                email,
                fullName,
                phone,
                rendaBase: Number.isFinite(rendaBase) ? rendaBase : 0,
                inicioMes: Number.isFinite(inicioMes) ? inicioMes : 1,
                themePreference
            };

            try {
                if(hasRemote){
                    await backendService.registerUser(dados);
                    showFeedback(cadastroFeedback, 'Cadastro realizado com sucesso! Redirecionando...', 'success');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 800);
                } else {
                    await handleLocalRegister(dados);
                    cadastroForm.reset();
                    showFeedback(loginFeedback, 'Cadastro realizado com sucesso! Faça login.', 'success');
                    toggleCadastro(false);
                }
            } catch (error) {
                console.error('Erro ao cadastrar usuário', error);
                const message = hasRemote ? mapApiError(error) : (error.message || 'Não foi possível concluir o cadastro.');
                showFeedback(cadastroFeedback, message);
            } finally {
                setLoading(submitButton, false);
            }
        });
    }

    if(hasRemote && backendService && typeof backendService.onAuthStateChanged === 'function'){
        backendService.onAuthStateChanged(async user => {
            if(user){
                try {
                    await backendService.loadUserDataToLocalCache();
                    window.location.href = 'index.html';
                } catch (error) {
                    console.error('Erro ao sincronizar dados após autenticação', error);
                }
            }
        });
    }
});
