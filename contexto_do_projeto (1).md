# Contexto Geral do Projeto: Sistema de Gestão de Medicamentos

## 1. Contexto Acadêmico e Metodológico
*   **Disciplina:** Engenharia de Software.
*   **Fundamentação Técnica:** Baseado estritamente nas aulas de Metodologias Ágeis, Scrum, Kanban e Engenharia de Requisitos.
*   **Abordagem de Desenvolvimento:** Metodologia Ágil (Scrum/Kanban) utilizando Engenharia de Requisitos Contínua/Incremental.
*   **Formato de Especificação:** Histórias de Usuário (*Como [ator], eu quero [objetivo], para que [benefício]*) suportadas por Critérios de Aceitação claros e Regras de Negócio.

## 2. Visão do Produto (O Problema e a Solução)
*   **O Problema:** A administração incorreta e simultânea de múltiplos remédios pode gerar interações medicamentosas adversas (potencialização ou anulação da eficácia).
*   **A Solução (5W2H):**
    *   **What:** Aplicativo mobile integrado para gestão de medicamentos e alertas.
    *   **Why:** Para evitar o cruzamento perigoso de medicações e garantir a administração no horário correto.
    *   **Where:** Plataforma mobile, utilizada na rotina diária de pacientes e cuidadores.
    *   **Who:** Ecossistema de cuidado: Idoso, Familiar, Cuidador e Médico.
    *   **How:** Através de validações lógicas de receitas e uma UI/UX extremamente intuitiva e simplificada.
    *   **When:** Entregas incrementais (Sprints).
    *   **How Much:** A ser estimado via pontuação do Backlog.

## 3. Delimitação de Escopo (Lean Inception: É/Não É | Faz/Não Faz)
*   **Escopo Incluído (O que o sistema FAZ):**
    *   Gestão de perfis e níveis de acesso (Idoso, Familiar, Cuidador, Médico).
    *   Inclusão e armazenamento de receitas e medicamentos.
    *   Processamento e alerta de cruzamento e interação medicamentosa.
    *   Agendamento e notificação de horários para uso das medicações.
    *   Geração e exportação de fichas médicas/histórico do paciente.
*   **Escopo Excluído (O que o sistema NÃO FAZ):**
    *   Não realiza comércio, venda ou cotação de medicamentos.
    *   Não substitui consultas médicas (ausência de telemedicina).
    *   Não gerencia controle financeiro ou estoque físico/validade de caixas de remédios.

## 4. Mapeamento de Stakeholders (Atores)
*   **Idoso:** Usuário-base primário; entidade central cujos dados médicos formam o histórico.
*   **Familiar:** Usuário supervisor; monitora se os horários foram cumpridos e acompanha a saúde geral.
*   **Cuidador:** Usuário operacional; recebe os alertas e identifica no aplicativo qual remédio administrar naquele exato momento.
*   **Médico:** Usuário especialista/analítico; consulta relatórios exportados e prescreve receitas com base no histórico seguro do sistema.

## 5. Requisitos Iniciais de Alto Nível
*   **Requisitos Funcionais (RF):**
    *   Cadastro de usuários e definição de papéis.
    *   Cadastro de medicamentos e vinculação com prescrições médicas.
    *   Validação de regras de negócio para interação medicamentosa adversa.
    *   Configuração e disparo de alertas de horário.
    *   Exportação de relatórios em formato estruturado (Ficha Médica).
*   **Requisitos Não Funcionais (RNF):**
    *   **RNF de Produto (Usabilidade):** Interface (UI) limpa, com textos grandes e fluxo (UX) com linguagem simples, adequada para leigos e idosos.
    *   **RNF de Produto (Eficiência/Plataforma):** Arquitetura voltada majoritariamente para dispositivos móveis (Mobile).