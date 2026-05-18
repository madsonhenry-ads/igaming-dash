# Product Requirements Document (PRD): Integração Betsala - Meta CAPI

## 1. Introdução

Este documento descreve os requisitos para o desenvolvimento de um backend server-side que atuará como intermediário entre a plataforma de afiliados da Betsala e a Conversions API (CAPI) do Meta (Facebook). O objetivo principal é garantir o rastreamento preciso e a atribuição correta de eventos de conversão (Registro, Depósito, CPA, FTD) gerados na Betsala, enviando-os de volta ao Facebook para otimização de campanhas de anúncios.

## 2. Objetivo

O objetivo deste backend é:

*   Receber postbacks da plataforma de afiliados da Betsala para eventos de conversão específicos.
*   Processar e normalizar os dados recebidos dos postbacks.
*   Enviar os eventos de conversão processados para a Meta CAPI, garantindo a correspondência de usuários e a atribuição correta.
*   Melhorar a precisão do rastreamento de conversões e a otimização de campanhas no Facebook Ads.

## 3. Escopo

### 3.1. Eventos de Conversão Suportados

O backend deverá suportar o rastreamento dos seguintes eventos de conversão, conforme indicado na imagem fornecida:

*   **Registro (Registration):** Quando um novo usuário se registra na Betsala.
*   **Depósito (Deposit):** Quando um usuário realiza um depósito na Betsala.
*   **CPA (Cost Per Acquisition):** Evento de aquisição de cliente, geralmente associado a um primeiro depósito ou outra ação qualificada.
*   **FTD (First Time Deposit):** O primeiro depósito realizado por um novo usuário.

### 3.2. Integração com a Betsala (Postbacks)

O backend receberá postbacks da plataforma de afiliados da Betsala. A estrutura exata dos postbacks (parâmetros e formato) precisará ser confirmada, mas espera-se que inclua informações como:

*   `Player ID`: Identificador único do jogador.
*   `Currency`: Moeda utilizada na transação.
*   `Registration Date`: Data de registro do usuário.
*   `Type`: Tipo de evento (Registro, Depósito, CPA, FTD).
*   Outros parâmetros relevantes para a atribuição, como `click_id`, `sub_id`, etc.

**Exemplo de URL de Postback (hipotético, baseado na imagem):**

`https://dash-igaming-app-production.up.railway.app/api/postback?player_id={player_id}&currency={currency}&registration_date={registration_date}&type={event_type}&click_id={click_id}`

### 3.3. Integração com a Meta CAPI

O backend enviará os eventos de conversão para a Meta CAPI. Para cada evento, os seguintes parâmetros serão essenciais para a correspondência de usuários e atribuição [1] [2]:

*   **`event_name`**: Nome do evento (ex: `CompleteRegistration`, `Deposit`, `Purchase`).
*   **`event_time`**: Timestamp do evento.
*   **`user_data`**: Informações do usuário para correspondência (hashing recomendado):
    *   `em` (email)
    *   `ph` (telefone)
    *   `fn` (primeiro nome)
    *   `ln` (sobrenome)
    *   `ct` (cidade)
    *   `st` (estado)
    *   `zip` (CEP)
    *   `country` (país)
    *   `fbc` (Facebook Click ID)
    *   `fbp` (Facebook Browser ID)
*   **`custom_data`**: Dados específicos do evento:
    *   `value` (valor da transação)
    *   `currency` (moeda)
    *   `content_ids` (IDs de conteúdo, se aplicável)
    *   `content_name` (nome do conteúdo, se aplicável)
    *   `status` (status do evento, ex: `completed`)
*   **`action_source`**: Fonte da ação (ex: `website`, `app`, `offline`).
*   **`event_source_url`**: URL onde o evento ocorreu.

## 4. Requisitos Funcionais

*   **RF001 - Recebimento de Postbacks:** O backend deve ser capaz de receber requisições HTTP POST/GET da plataforma de afiliados da Betsala para os eventos de Registro, Depósito, CPA e FTD.
*   **RF002 - Validação de Postbacks:** O backend deve validar a integridade e autenticidade dos postbacks recebidos (ex: token de segurança, IP de origem).
*   **RF003 - Extração e Normalização de Dados:** O backend deve extrair os parâmetros relevantes dos postbacks da Betsala e normalizá-los para o formato esperado pela Meta CAPI.
*   **RF004 - Mapeamento de Eventos:** O backend deve mapear os eventos da Betsala para os eventos padrão ou personalizados da Meta CAPI (ex: Registro -> `CompleteRegistration`, Depósito -> `Purchase`).
*   **RF005 - Geração de `user_data`:** O backend deve coletar e fazer hash das informações do usuário (email, telefone, etc.) para o parâmetro `user_data` da Meta CAPI, conforme as melhores práticas de privacidade do Facebook [2].
*   **RF006 - Envio para Meta CAPI:** O backend deve enviar os eventos processados para o endpoint da Meta CAPI via requisições HTTP POST.
*   **RF007 - Tratamento de Erros e Retentativas:** O backend deve implementar um mecanismo de tratamento de erros e retentativas para garantir a entrega dos eventos à Meta CAPI em caso de falhas temporárias.
*   **RF008 - Deduplicação de Eventos:** O backend deve ser capaz de lidar com a deduplicação de eventos, utilizando o `event_id` e `event_name` para evitar o envio duplicado de eventos para a Meta CAPI [3].

## 5. Requisitos Não Funcionais

*   **RNF001 - Performance:** O backend deve ser capaz de processar um alto volume de postbacks e enviar eventos para a Meta CAPI com baixa latência.
*   **RNF002 - Segurança:** O backend deve garantir a segurança dos dados do usuário e da comunicação com a Betsala e a Meta CAPI (ex: HTTPS, autenticação).
*   **RNF003 - Escalabilidade:** A arquitetura do backend deve ser escalável para suportar o crescimento futuro do volume de eventos.
*   **RNF004 - Monitoramento e Logging:** O backend deve incluir funcionalidades de monitoramento e logging para rastrear o status dos eventos, identificar erros e depurar problemas.
*   **RNF005 - Configuração:** As credenciais da Meta CAPI (Access Token, Pixel ID) e outros parâmetros configuráveis devem ser armazenados de forma segura (ex: variáveis de ambiente).

## 6. Arquitetura Proposta (Sugestão)

Uma arquitetura sugerida para o backend pode incluir os seguintes componentes:

*   **API Gateway:** Para receber os postbacks da Betsala.
*   **Serviço de Processamento de Eventos:** Uma aplicação (ex: Node.js, Python com Flask/FastAPI) que lida com a validação, extração, normalização e mapeamento dos dados.
*   **Fila de Mensagens (Opcional, para alta escala):** Para desacoplar o recebimento do postback do envio para a Meta CAPI, garantindo resiliência e retentativas (ex: RabbitMQ, Kafka, SQS).
*   **Serviço de Envio para Meta CAPI:** Responsável por construir e enviar as requisições para a Meta CAPI.
*   **Banco de Dados (Opcional):** Para armazenar logs de eventos, status de envio e informações para deduplicação.

## 7. Próximos Passos

1.  **Confirmação dos Parâmetros de Postback da Betsala:** Obter a documentação exata ou exemplos de postbacks da plataforma de afiliados da Betsala, incluindo todos os macros disponíveis.
2.  **Definição dos Eventos da Meta CAPI:** Decidir quais eventos padrão ou personalizados da Meta CAPI serão utilizados para cada evento da Betsala.
3.  **Identificação de Dados do Usuário:** Determinar quais informações do usuário (email, telefone, etc.) estão disponíveis nos postbacks da Betsala para serem enviadas à Meta CAPI.
4.  **Desenvolvimento e Testes:** Implementar o backend e realizar testes rigorosos para garantir a correta integração e rastreamento.

## 8. Referências

[1] [Parameters - Meta for Developers](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters)
[2] [Customer Information Parameters - Meta for Developers](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters)
[3] [Facebook Conversions API - Extended 2026 Setup Guide](https://stape.io/blog/how-to-set-up-facebook-conversion-api)
