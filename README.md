# 🧠 MemPalace + LM Notebook: O Cérebro do seu Projeto

Bem-vindo ao seu sistema de memória de longo prazo integrado! Este projeto foi estruturado para dar ao seu assistente de IA uma memória persistente, local-first e semântica, simulando um **NotebookLM próprio e privado**.

---

## 🏛️ Estrutura do Sistema

*   **`lm_notebook.ipynb`**: O seu Notebook principal. Aqui você pode carregar seus documentos, conversar com seu "Cérebro" de IA e gerenciar suas memórias. Ele suporta tanto modelos locais (via **LM Studio** ou **Ollama**) quanto modelos em nuvem (**Google Gemini** ou **OpenAI**).
*   **`test_memory/`**: Diretório criado para você colocar arquivos de teste (documentos, códigos, notas, etc.) que deseja que o cérebro aprenda e lembre.
*   **Palácio de Memória**: O banco de dados vetorial de memórias fica armazenado localmente em seu computador (geralmente sob `~/.mempalace/` ou pasta personalizada), garantindo total privacidade.

---

## 🚀 Como Iniciar

### 1. Preparar o Ambiente
Recomendamos criar um ambiente virtual Python para manter as dependências isoladas. Abra o terminal na pasta deste projeto e execute:

```bash
# Criar o ambiente virtual
python -m venv .venv

# Ativar o ambiente virtual (Windows)
.venv\Scripts\activate

# Instalar as dependências necessárias
pip install mempalace jupyter openai google-generativeai chromadb
```

### 2. Inicializar o Palácio
Antes do primeiro uso, você precisa inicializar o seu banco de dados de memórias. No terminal ativo com o ambiente virtual, execute:
```bash
mempalace init
```

### 3. Executar o LM Notebook
Para abrir o seu "cérebro" interativo e começar a utilizá-lo, execute no terminal:
```bash
jupyter notebook lm_notebook.ipynb
```
Isso abrirá o Jupyter no seu navegador, onde você poderá rodar as células de chat e importação passo a passo.

---

## 📂 Comandos Úteis do MemPalace CLI

O MemPalace possui uma ferramenta de linha de comando poderosa. Aqui estão os principais comandos que você pode rodar a partir do terminal do seu projeto:

*   **Importar (Minerar) Documentos:**
    Para fazer a IA ler e memorizar todos os arquivos de uma pasta (ex: `test_memory`):
    ```bash
    mempalace mine ./test_memory
    ```
*   **Importar Transcrições de Conversas:**
    Se você salvou o histórico de um chat do Claude/ChatGPT e quer que o cérebro lembre de tudo:
    ```bash
    mempalace mine ./caminho_dos_chats --mode convos
    ```
*   **Buscar nas Memórias:**
    Para pesquisar o que o seu cérebro sabe sobre um assunto diretamente pelo terminal:
    ```bash
    mempalace search "sua pergunta ou termo de busca"
    ```

---

## 🔌 Conectando como Servidor MCP (Cursor / Claude Desktop / VS Code)

Para que o seu assistente de IA no editor (como Cursor ou Claude Code) utilize autonomamente a mesma base de memórias que você gerencia no Notebook, você pode ativá-lo como um servidor MCP.

### No Cursor ou Claude Desktop:
Adicione a seguinte configuração nas configurações do MCP:

*   **Nome:** `mempalace`
*   **Tipo:** `command`
*   **Comando:** `python`
*   **Argumentos:** `["-m", "mempalace.mcp_server"]`

Isso dará aos assistentes a capacidade de pesquisar e lembrar de decisões arquiteturais do seu projeto automaticamente!
