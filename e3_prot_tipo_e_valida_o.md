# E3: Protótipo e Validação – Sistema de Gestão de Medicamentos

**Projeto:** Sistema de Gestão de Medicamentos e Alerta de Interações Clínicas (*MedControl*)  
**Componente Curricular:** Engenharia de Software – Unochapecó  
**Docente:** Prof. Mauricio Antonio Zonta  
**Data:** 09/11/2026 | **Versão:** 1.0  

*(Espaço reservado para o link do protótipo no Figma/Marvel e capturas de tela das interfaces)*  
*Link do Protótipo:* `[Inserir link compartilhável aqui]`

---

## 1. Identificação e Descrição das Telas Centrais

Desenvolvemos o protótipo com foco total na facilidade de uso para idosos e cuidadores, priorizando letras grandes, botões fáceis de tocar e linguagem direta.

* **Tela 1: Minha Rotina (Início / Dashboard)**  
  É o ponto central do app, pensato para o paciente ou cuidador bater o olho e já saber o que fazer. Traz a data, uma saudação amigável e a divisão dos remédios por turnos (Manhã, Tarde e Noite). Cada remédio fica em um cartão com nome comercial, dosagem, horário e o estado atual ("Pendente", "Tomado" ou "Atrasado").  
  *\[Inserir imagem da Tela 1 aqui\]*

* **Tela 2: Alarme e Confirmação de Horário**  
  Quando dá a hora exata da medicação, a tela se abre em destaque com alerta sonoro e visual. Exibe o nome do remédio em fonte grande, instruções de apoio (ex.: *"Tomar com bastante água após o almoço"*) e dois botões de ação rápida: um verde grande para **"Confirmar Tomada"** e um botão secundário para **"Lembrar em 10 minutos"**.  
  *\[Inserir imagem da Tela 2 aqui\]*

* **Tela 3: Cadastrar Remédio / Receita**  
  Área usada pelo familiar ou cuidador para adicionar novos tratamentos. O usuário informa o nome do remédio, princípio ativo, dosagem, frequência de horários e a data de término do tratamento, além de contar com um botão para fotografar e anexar a receita médica física.  
  *\[Inserir imagem da Tela 3 aqui\]*

* **Tela 4: Alerta de Interação Medicamentosa (Aviso Crítico)**  
  Se um novo remédio cadastrado entrar em conflito grave com outro que o paciente já toma, o sistema trava o salvamento e abre este aviso vermelho de atenção. A tela explica em linguagem simples o perigo (ex.: queda brusca de pressão ou corte de efeito) e só deixa prosseguir se o usuário marcar a caixa confirmando que o médico está ciente.  
  *\[Inserir imagem da Tela 4 aqui\]*

* **Tela 5: Ficha Médica e Relatório em PDF**  
  Painel voltado para acompanhamento e consultas. Apresenta o percentual de adesão aos remédios nos últimos 30 dias, histórico de doses perdidas e um botão direto para gerar um PDF organizado ou compartilhar o arquivo com o médico.  
  *\[Inserir imagem da Tela 5 aqui\]*

---

## 2. Fluxo de Navegação entre as Telas Principais

O fluxo foi desenhado para ser curto e sem menus complexos:

```
                  ┌──────────────────────────────┐
                  │      Início / Login          │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │ Tela 1: Minha Rotina         │◄─────────────────────────────┐
                  │ (Dashboard Principal)        │                              │
                  └──────┬───────────────┬───────┘                              │
                         │               │                                      │
        Horário do Remédio│               │ Toque no Botão '+'                   │ Acesso ao Menu
                         ▼               ▼                                      ▼
  ┌────────────────────────────┐   ┌───────────────────────────┐  ┌───────────────────────────┐
  │ Tela 2: Alarme e           │   │ Tela 3: Cadastro de       │  │ Tela 5: Ficha Médica e    │
  │ Confirmação de Tomada      │   │ Remédio / Receita         │  │ Exportação em PDF         │
  └──────────────┬─────────────┘   └─────────────┬─────────────┘  └─────────────┬─────────────┘
                 │                               │                              │
                 │ Ação: "Confirmar Tomada"      │ Validação de Conflito        │ Gerar / Enviar PDF
                 │ ou "Adiar 10 min"             ▼                              │
                 │                     [ Tem Risco de ]                         │
                 │                     [ Interação?   ]                         │
                 │                        /          \                          │
                 │                  Sim  /            \ Não                     │
                 │                      ▼              ▼                        │
                 │            ┌───────────────┐   (Salvo com sucesso)           │
                 │            │ Tela 4:       │        │                        │
                 │            │ Alerta de     │        │                        │
                 │            │ Interação     │        │                        │
                 │            └───────┬───────┘        │                        │
                 │                    │ Confirmado     │                        │
                 ▼                    ▼                ▼                        ▼
  [ Dose Registrada ] ────────► [ Atualiza Rotina ] ────────────────────────────┘
```

---

## 3. Matriz de Rastreabilidade (Telas × Histórias de Usuário × Requisitos)

| Tela | Nome da Tela | História de Usuário (US) | Requisito Atendido |
| :--- | :--- | :--- | :--- |
| **Tela 1** | Minha Rotina | **US-04:** Registro de que o remédio foi tomado. | **RF:** Visualização e acompanhamento do cronograma diário.<br>**RNF:** Usabilidade voltada para o público idoso (tipografia ampla e contraste adequado). |
| **Tela 2** | Alarme e Confirmação | **US-03:** Notificação nos horários programados. | **RF:** Emissão de alertas sonoros e visuais de horários.<br>**RNF:** Disponibilidade/Robustez para disparar alarmes locais sem internet. |
| **Tela 3** | Cadastro de Remédio | **US-01:** Cadastro de prescrições e medicamentos. | **RF:** Módulo para registro de fármacos e anexação de foto da receita.<br>**RNF:** Integridade e validação de campos obrigatórios. |
| **Tela 4** | Alerta de Interação | **US-02:** Aviso de conflito entre medicações. | **RF:** Motor de regras para detecção de interações medicamentosas.<br>**RNF:** Segurança clínica do paciente. |
| **Tela 5** | Ficha Médica | **US-05:** Exportação de relatório para o médico. | **RF:** Geração e exportação da ficha de histórico em PDF.<br>**RNF:** Portabilidade móvel para múltiplos dispositivos. |

---

## 4. Roteiro Curto de Validação com Parte Interessada

* **Participante do Teste:** Dona Marlene (68 anos, faz uso contínuo de 4 medicamentos) acompanhada por sua filha Camila (familiar supervisora).
* **Objetivo:** Observar se um paciente idoso consegue entender a rotina e confirmar a medicação com autonomia, e se a cuidadora compreende os alertas de risco.

### Tarefas Solicitadas:
1. **Tarefa 1:** Abrir o aplicativo e dizer qual é o próximo remédio programado para o turno da manhã.
2. **Tarefa 2:** Simular o toque do alarme de horário (Tela 2) e registrar que a dose foi tomada.
3. **Tarefa 3:** Acompanhar a filha simulando o cadastro de um novo anti-inflamatório que cause interação com a medicação atual (Telas 3 e 4) e avaliar o entendimento do alerta de perigo.
4. **Tarefa 4:** Ir até a área médica (Tela 5) e simular a exportação da ficha em PDF para levar à consulta.

---

## 5. Retornos Obtidos e Decisões Registradas pela Equipe

### Retornos da Participante (Feedbacks):
* **Pontos Fortes:** O botão verde grande da Tela 2 foi considerado excelente, pois facilitou o toque sem medo de errar. A divisão da rotina em "Manhã, Tarde e Noite" foi compreendida de imediato pela idosa.
* **Dificuldade Encontrada:** No primeiro rascunho da Tela 4, a mensagem de perigo usava termos farmacológicos técnicos (*"risco de potencialização antagonista"*), o que deixou a usuária assustada e sem saber exatamente qual atitude tomar.
* **Sugestão Prática:** Dona Marlene sugeriu que os cartões da rotina diária tivessem desenhos bem claros indicando se o remédio deve ser tomado em jejum ou junto com a comida.

### Decisões de Ajuste Tomadas pela Equipe:
1. **Linguagem Leiga no Alerta Crítico (Tela 4):** Substituímos as descrições técnicas por orientações simples e diretas, como: *"Atenção: Tomar estes dois remédios juntos anula o efeito ou pode baixar muito a pressão. Fale com seu médico antes de tomar."*
2. **Ícones Visuais na Rotina (Tela 1):** Incluímos pequenos ícones ilustrativos nos cartões (ex.: um prato de comida para "após as refeições" e um copo de água para "em jejum"), facilitando a identificação rápida sem necessidade de leitura detalhada.