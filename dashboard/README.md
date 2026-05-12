# CRM de Leads para iGaming

Sistema de gerenciamento de leads para iGaming com rastreamento por ClickID, sistema de tags e integração com postbacks de plataformas iGaming.

## 📋 Funcionalidades

### Gestão de Leads
- **Rastreamento por ClickID**: Cada lead é rastreado por um ClickID único
- **Sistema de Tags**: Tags automáticas baseadas em eventos do CRM (visitante, ftd, deposito, redeposito, recuperacao)
- **Timeline de Eventos**: Histórico completo de eventos por lead
- **Filtros Avançados**: Busca por nome, email, telefone, ClickID, status, fonte e tags

### Integrações
- **Postback API**: Recebe eventos de plataformas iGaming (FTD, depósito, redépósito, recuperação)
- **Facebook Ads**: Sincronização de campanhas e métricas
- **Múltiplas Fontes**: Suporte para Facebook, Google, Instagram, TikTok e tráfego direto

### Dashboard
- **Métricas em Tempo Real**: Total de leads, ativos, novos, inativos e churned
- **Taxa de Conversão**: Visualização de leads convertidos
- **Distribuição por Fonte**: Análise de tráfego por canal
- **Eventos Recentes**: Últimas atividades dos leads

## 🚀 Instalação

### Pré-requisitos
- **Node.js** 18.x ou superior
- **PostgreSQL** 14.x ou superior
- **npm** ou **pnpm**

### Passos

1. **Instalar dependências**
```bash
cd dashboard
npm install
```

2. **Configurar variáveis de ambiente**

Crie um arquivo `.env.local` na pasta `dashboard`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/crm_db"

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"

# Application URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Facebook Ads (opcional)
FACEBOOK_APP_ID=""
FACEBOOK_APP_SECRET=""
FACEBOOK_ACCESS_TOKEN=""
FACEBOOK_PIXEL_ID=""
FACEBOOK_WEBHOOK_VERIFY_TOKEN=""

# Postback Security
POSTBACK_WEBHOOK_SECRET="your-webhook-secret"
POSTBACK_HMAC_SECRET="your-hmac-secret"

# Tags disponíveis
LEAD_TAGS="visitante,ftd,deposito,redeposito,recuperacao"
```

3. **Configurar o banco de dados**
```bash
# Gerar Prisma Client
npx prisma generate

# Enviar schema para o banco
npx prisma db push

# (Opcional) Popular o banco com dados de exemplo
npx prisma db seed
```

4. **Executar o servidor de desenvolvimento**
```bash
npm run dev
```

Acesse: **http://localhost:3000**

5. **Criar conta de admin**
```bash
# Registre-se em /register
# Execute no banco de dados:
UPDATE users SET role = 'ADMIN', status = 'ACTIVE' WHERE email = 'seu-email@exemplo.com';
```

## 📡 APIs

### Gestão de Leads

**Criar Lead**
```bash
POST /api/leads
Content-Type: application/json

{
  "clickId": "fb-click-123",
  "email": "lead@example.com",
  "name": "Lead Name",
  "source": "facebook",
  "campaignId": "fb-camp-1",
  "tags": ["visitante"],
  "metadata": {
    "fbc": "fb.1.1234567890.123456789",
    "device": "mobile"
  }
}
```

**Listar Leads**
```bash
GET /api/leads?page=1&limit=50&search=lead&status=ACTIVE&source=facebook&tag=ftd
```

**Detalhes do Lead**
```bash
GET /api/leads/{clickId}
```

**Gerenciar Tags**
```bash
PUT /api/leads/{clickId}/tags
Content-Type: application/json

{
  "action": "add", // ou "remove"
  "tag": "ftd",
  "reason": "Tag adicionada manualmente"
}
```

### Postback iGaming

**Enviar Postback**
```bash
POST /api/postback
Content-Type: application/json
X-Webhook-Secret: your-webhook-secret

{
  "clickId": "fb-click-123",
  "event": "ftd", // registration, ftd, deposit, redeposit, recovery, withdrawal, bet
  "amount": 100.00,
  "currency": "BRL",
  "metadata": {
    "userId": "12345",
    "ip": "192.168.1.1"
  }
}
```

### Facebook Ads

**Listar Campanhas**
```bash
GET /api/admin/facebook
```

**Sincronizar Campanhas**
```bash
POST /api/admin/facebook/sync
Content-Type: application/json

{
  "adAccountId": "act_1234567890",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

**Webhook Facebook**
```bash
GET /api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
POST /api/webhooks/facebook
```

## 🏷️ Tags Disponíveis

| Tag | Descrição | Gatilho |
|-----|-----------|---------|
| visitante | Lead visitou o site | registration |
| ftd | First Time Deposit | ftd |
| deposito | Realizou depósito | deposit |
| redeposito | Realizou novo depósito | redeposit |
| recuperacao | Lead recuperado | recovery |
| saque | Realizou saque | withdrawal |
| aposta | Realizou aposta | bet |

## 🎯 Estados do Lead

| Estado | Descrição |
|--------|-----------|
| NEW | Lead recém-criado |
| ACTIVE | Lead ativo (com depósito ou FTD) |
| INACTIVE | Lead inativo |
| CHURNED | Lead que deu churn |

## 📊 Dashboard

O dashboard mostra:
- **Total de Leads**: Todos os leads na base
- **Active Leads**: Leads com status ACTIVE
- **New Leads**: Leads recém-criados
- **Inactive Leads**: Leads inativos
- **Churned Leads**: Leads que deram churn
- **Conversion Rate**: Taxa de conversão de leads
- **Traffic Sources**: Distribuição por fonte de tráfego
- **Tag Distribution**: Distribuição de tags
- **Recent Events**: Últimos eventos dos leads

## 🔧 Configuração

### Programa
Vá em `/admin/program-settings` para configurar:
- Nome do produto
- Nome do programa
- URL do website
- Moeda
- Nome da empresa

### Facebook Ads
Vá em `/admin/facebook` para:
- Sincronizar campanhas
- Ver métricas de performance
- Configurar webhooks

## 🚦 Como funciona

### Fluxo de Lead

1. **Clique**: Usuário clica no anúncio → Gera ClickID
2. **Lead Criação**: Lead criado no sistema com ClickID
3. **Evento Postback**: Plataforma iGaming envia postback
4. **Tag Automática**: Sistema aplica tag baseada no evento
5. **Status Update**: Status do lead é atualizado
6. **Timeline**: Evento adicionado à timeline do lead

### Exemplo Completo

```bash
# 1. Criar lead (pode ser feito automaticamente via tráfego)
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "clickId": "fb-123456",
    "email": "user@example.com",
    "source": "facebook",
    "campaignId": "camp-789"
  }'

# 2. Usuário se registra no site iGaming
curl -X POST http://localhost:3000/api/postback \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: secret" \
  -d '{
    "clickId": "fb-123456",
    "event": "registration"
  }'
# → Tag "visitante" adicionada

# 3. Usuário faz primeiro depósito (FTD)
curl -X POST http://localhost:3000/api/postback \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: secret" \
  -d '{
    "clickId": "fb-123456",
    "event": "ftd",
    "amount": 100.00
  }'
# → Tag "ftd" adicionada
# → Status do lead mudado para ACTIVE

# 4. Usuário faz mais um depósito
curl -X POST http://localhost:3000/api/postback \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: secret" \
  -d '{
    "clickId": "fb-123456",
    "event": "redeposit",
    "amount": 50.00
  }'
# → Tag "redeposito" adicionada

# 5. Verificar lead
curl http://localhost:3000/api/leads/fb-123456
```

## 📚 Documentação

- [Database Schema](./docs/DATABASE.md)
- [API Reference](./docs/API.md)
- [Postback Integration](./docs/POSTBACK.md)
- [Facebook Ads Integration](./docs/FACEBOOK.md)

## 📄 Licença

MIT
