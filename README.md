# Dose Dupla · Protótipo demonstrativo

Protótipo **100% estático** do **Dose Dupla**, um aplicativo de gestão de medicamentos,
rotina de doses e alerta de interações clínicas.

Esta versão foi preparada para **apresentação e publicação no Vercel**. Não há cadastro,
login, troca de usuário ou banco de dados: a demonstração já abre pronta, com dados de
exemplo na memória do navegador.

> **Importante:** é apenas um protótipo acadêmico (E3 · Engenharia de Software · Unochapecó).
> Não substitui orientação médica ou farmacêutica.

---

## O que a demonstração mostra

- **Minha Rotina** — doses do dia separadas por turno (manhã, tarde e noite), com status
  calculado em tempo real: tomado, pendente, atrasado, adiado ou perdido.
- **Alarme da dose** — confirmação da tomada ou opção de lembrar em 10 minutos.
- **Cadastro de remédio** — busca no bulário local (mais de mil medicamentos), preenchimento
  automático dos dados e verificação de interações medicamentosas.
- **Alerta de interação** — bloqueia o cadastro até o usuário confirmar que o médico está ciente.
- **Ficha médica** — adesão dos últimos 30 dias, doses perdidas, atrasos, alertas registrados
  e geração de **PDF no próprio navegador**.

### Dados de exemplo

- **Camila Souza** (perfil familiar) acompanha **Marlene da Silva** (72 anos).
- Medicamentos: Levotiroxina 50 mcg, Losartana 50 mg, Metformina 850 mg,
  AAS 100 mg e Sinvastatina 20 mg.
- Histórico de 30 dias gerado automaticamente para demonstrar a ficha médica.
- Um alerta de interação já registrado no histórico.

No menu **Sobre** também é possível alternar apenas a **visão da demonstração** entre
**Camila (familiar)** e **Marlene (idoso)**, sem criar conta ou trocar de usuário de verdade.
O botão **Sobre → Reiniciar demonstração** restaura o estado inicial a qualquer momento.
Como tudo fica em memória, **recarregar a página também reinicia a demonstração**.

---

## Estrutura do projeto

```
public/
  index.html                    Página única do protótipo
  styles.css                    Tema visual pastel + moldura de celular
  app.js                        Interface, navegação e interações
  demo.js                       Dados de exemplo e "API" em memória
  catalogo.js                   Busca no bulário local
  pdf.js                        Gerador de PDF no navegador
  catalogo-medicamentos.json    Catálogo estático de medicamentos

vercel.json                     Configuração de publicação estática
.vercelignore                   Arquivos que não vão para o deploy
_legacy/                        Back-end antigo (Node.js + JSON), fora do ar
```

O conteúdo de `_legacy/` **não é usado** pela demonstração. Ele foi mantido apenas como
registro da versão anterior, que rodava com `node server.js` e gravava em `data/db.json`.

---

## Publicar no Vercel

### Opção 1 — Pelo painel (recomendada)

1. Envie esta pasta para um repositório no GitHub/GitLab/Bitbucket.
2. No [Vercel](https://vercel.com/new), importe o repositório.
3. Em **Framework Preset**, escolha **Other**.
4. Não informe *Build Command* nem *Install Command*.
5. Confirme **Output Directory** como `public` (já definido no `vercel.json`).
6. Clique em **Deploy**.

O Vercel publica apenas os arquivos de `public/`. Não há função serverless, banco ou
variável de ambiente para configurar.

### Opção 2 — Pela CLI

```bash
npm i -g vercel
vercel
```

Aceite as opções detectadas e confirme o deploy. Para publicar em produção:

```bash
vercel --prod
```

---

## Como funciona sem servidor

O arquivo `public/demo.js` substitui a antiga API por uma base de exemplo em memória.
As chamadas que antes iam para `/api/...` agora são atendidas por
`window.DoseDuplaDemo.requisitar(...)`, sem rede e sem persistência.

- **Nada é salvo no navegador** (não usa `localStorage`).
- O catálogo é o único arquivo buscado pela rede: `public/catalogo-medicamentos.json`.
- O PDF é montado no navegador por `public/pdf.js` e baixado como arquivo `.pdf`.
- As ações de cadastrar remédio e confirmar dose alteram apenas os dados em memória,
  servindo para explicar o funcionamento durante a apresentação.

---

## Requisitos

Nenhum. Basta um navegador moderno com JavaScript habilitado. A publicação no Vercel
não exige Node.js instalado na máquina.
