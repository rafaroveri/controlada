# Controlada 💰

Um sistema moderno de controle financeiro pessoal desenvolvido com HTML, CSS e JavaScript vanilla.

## 📋 Sobre o Projeto

Controlada é uma aplicação web para gerenciamento de finanças pessoais que permite:

- 💰 Controle de renda mensal
- 📊 Registro e categorização de gastos
- 📈 Visualização de dados através de gráficos
- 🎯 Acompanhamento de sobra mensal
- 📱 Interface responsiva e moderna

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Autenticação / API**: REST API com tokens JWT (Node.js/Express - planejado)
- **Banco de Dados**: PostgreSQL 16 (planejado)
- **Gráficos**: Chart.js
- **Fontes**: Google Fonts (Rubik)

## 🎨 Características

- ✨ Design moderno com glassmorphism
- 🌈 Sistema de cores harmoniosas
- 📱 Totalmente responsivo
- 🔐 Sistema de autenticação seguro
- 💾 Armazenamento local e em nuvem
- 🎯 Interface intuitiva e amigável

## 📁 Estrutura do Projeto

```
Controlada/
│
├── index.html              # Página principal
├── login.html              # Página de login/cadastro
├── assets/
│   ├── css/
│   │   ├── style.css       # Estilos principais
│   │   └── login.css       # Estilos do login
│   ├── js/
│   │   ├── main.js         # Lógica principal
│   │   └── login.js        # Lógica de autenticação
│   ├── images/
│   │   └── logo.png        # Logo da aplicação
│   └── config/
│       └── app-config.js       # Configuração da API / aplicação
└── docs/
    ├── database/
    │   └── postgresql.md   # Plano de migração e modelo de dados
    ├── cores.txt           # Paleta de cores
    └── Melhorias.txt       # Lista de melhorias
```

## 🚀 Como Executar

1. Clone o repositório:
```bash
git clone https://github.com/[seu-usuario]/controlada.git
```

2. Navegue até o diretório:
```bash
cd controlada
```

3. Configure a API:
   - Defina o endpoint base da sua API REST no arquivo `assets/config/app-config.js`
   - Consulte o documento `docs/database/postgresql.md` para detalhes sobre o backend sugerido

4. Abra o `index.html` em um navegador ou use um servidor local:
```bash
# Usando Python
python -m http.server 8000

# Usando Node.js (http-server)
npx http-server
```

## 📋 Funcionalidades

### 💰 Gestão de Renda
- Definir renda mensal
- Editar renda através de modal intuitivo
- Cálculo automático de sobra

### 📊 Controle de Gastos
- Adicionar gastos com descrição, valor, categoria e método de pagamento
- Categorias personalizáveis com cores
- Histórico organizado por mês/ano
- Visualização em tabela ou cards

### 📈 Relatórios e Gráficos
- Gráficos de gastos por categoria
- Análise temporal dos gastos
- Estatísticas mensais

### ⚙️ Configurações
- Configurar dia de início do ciclo financeiro
- Gerenciar categorias personalizadas
- Configurações de conta

## 🎨 Design System

O projeto utiliza uma paleta de cores cuidadosamente selecionada:

- **Verde Principal**: #4d6619 (Dark Moss Green)
- **Verde Claro**: #8fbc8f (Dark Sea Green)
- **Amarelo Verde**: #9acd32 (Yellow Green)
- **Cinza**: #b2beb5 (Ash Gray)

## 📱 Responsividade

A aplicação é totalmente responsiva e funciona perfeitamente em:
- 💻 Desktop (1024px+)
- 📱 Tablets (768px - 1024px)
- 📱 Smartphones (até 768px)

## 🔐 Segurança

- Autenticação baseada em tokens JWT (planejada)
- Sessões validadas pelo backend Node.js
- Validação de entrada de dados tanto no frontend quanto no backend
- Estratégia de sincronização incremental com PostgreSQL

## 🗃️ Planejamento de Banco de Dados

Toda a estratégia de migração do Firebase para PostgreSQL, incluindo o modelo relacional, mapeamento de endpoints e estratégia de ETL, está documentada em `docs/database/postgresql.md`.

## 🤝 Contribuição

Contribuições são bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 👨‍💻 Autor

**Rafael Roveri**
- Email: rafaelrcm2001@gmail.com
- GitHub: [@rafaelroveri](https://github.com/rafaelroveri)

## 📞 Suporte

Se você encontrar algum problema ou tiver sugestões, por favor abra uma [issue](https://github.com/[seu-usuario]/controlada/issues).

## 🧪 Testes

Para executar os testes unitários utilize o npm:

```bash
npm install
npm test
```

---

⭐ Se este projeto te ajudou, não esqueça de dar uma estrela!
