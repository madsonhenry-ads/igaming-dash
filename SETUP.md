# DASH-IGAMING - Setup Completo

## Pré-requisitos

- Docker Desktop instalado e rodando
- Node.js 20+ instalado
- Git instalado
- Windows (para scripts .bat) ou Linux/Mac (para scripts .sh)

## Arquitetura Atual

```
C:/DASH-IGAMING/
├── infrastructure/
│   └── docker/
│       ├── docker-compose.yml     # Todos os serviços
│       ├── nginx.conf             # Gateway API
│       └── init.sql               # Schema do banco
├── services/
│   ├── postback/                  # S2S Postback Service
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/index.js
│   └── whatsapp/                  # WhatsApp Service
│       ├── Dockerfile
│       ├── package.json
│       └── src/index.js
├── dashboard/                     # Refferq (Next.js)
│   ├── .env.local                 # Configurações do dashboard
│   ├── Dockerfile
│   └── prisma/schema.prisma       # Schema extendido iGaming
├── shared/
│   └── types/index.ts             # TypeScript compartilhado
├── start.bat                      # Quick start (Windows)
└── README.md                      # Documentação geral
```

## Método 1: Início Rápido (Windows)

1. **Execute o script de inicialização:**

```batch
cd C:/DASH-IGAMING
start.bat
```

Isso irá:
- Iniciar Docker com PostgreSQL, Redis e Evolution API
- Instalar dependências
- Gerar schema do Prisma
- Iniciar todos os serviços

## Método 2: Setup Manual

### 1. Iniciar Infraestrutura Docker

```bash
cd C:/DASH-IGAMING/infrastructure/docker
docker-compose up -d
```

Verifique se tudo está rodando:

```bash
docker-compose ps
```

### 2. Configurar Dashboard

```bash
cd C:/DASH-IGAMING/dashboard
npm install
npm run db:generate
npm run db:push
```

### 3. Iniciar Dashboard

```bash
npm run dev
```

Acesse: http://localhost:3000

### 4. Configurar Postback Service (novo terminal)

```bash
cd C:/DASH-IGAMING/services/postback
npm install
npm run dev
```

### 5. Configurar WhatsApp Service (novo terminal)

```bash
cd C:/DASH-IGAMING/services/whatsapp
npm install
npm run dev
```

## Configurar Evolution API (WhatsApp)

1. **Criar instância:**

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: changeme" \
  -d '{"instanceName": "dashigaming"}'
```

2. **Conectar QR Code:**

```bash
curl -X GET http://localhost:8080/instance/connect/dashigaming \
  -H "apikey: changeme"
```

3. **Escaneie o QR Code no seu WhatsApp**

## Variáveis de Ambiente

Crie `.env` na raiz do projeto:

```bash
POSTGRES_PASSWORD=changeme
JWT_SECRET=changeme-super-secret-key-minimum-32-characters
NEXTAUTH_SECRET=changeme-super-secret-key-minimum-32-characters
WEBHOOK_SECRET=changeme-webhook-secret
EVOLUTION_API_KEY=changeme
```

## API Endpoints

### Dashboard (http://localhost:3000)
- Home: Interface de gestão de afiliados
- API: `/api/*` (via Next.js API routes)

### Postback (http://localhost:3001)
- Health: `GET /health`
- Receber Evento: `POST /api/v1/postback`
- Listar por Click ID: `GET /api/v1/postbacks/:clickId`
- Docs: `GET /docs`

**Exemplo Postback:**

```bash
curl -X POST http://localhost:3001/api/v1/postback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer changeme" \
  -d '{
    "clickId": "fb_abc123",
    "event": "deposit",
    "amount": 100.50,
    "currency": "BRL",
    "timestamp": "2026-05-10T15:30:00Z",
    "userId": "user_123"
  }'
```

### WhatsApp (http://localhost:3002)
- Health: `GET /health`
- Enviar Mensagem: `POST /api/v1/send`
- Enviar em Massa: `POST /api/v1/send-bulk`
- Listar Templates: `GET /api/v1/templates`

**Exemplo Envio:**

```bash
curl -X POST http://localhost:3002/api/v1/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511999999999",
    "message": "Olá! Bem-vindo ao nosso cassino!",
    "instance": "dashigaming"
  }'
```

## Schema do Banco de Dados

As tabelas principais criadas incluem:

**Refferq:**
- `users`, `affiliates`, `referrals`
- `conversions`, `commissions`, `payouts`

**iGaming:**
- `postback_events` - Eventos S2S
- `facebook_campaigns` - Campanhas Meta
- `facebook_metrics` - Métricas diárias
- `whatsapp_messages` - Logs de mensagens

## Troubleshooting

### PostgreSQL não conecta

```bash
docker-compose down -v
docker-compose up -d
```

### Dashboard não inicia

```bash
cd C:/DASH-IGAMING/dashboard
rm -rf .next node_modules
npm install
npm run dev
```

### Evolution API erro

```bash
docker-compose restart evolution-api
```

### Verificar logs

```bash
docker-compose logs -f dashboard
docker-compose logs -f postback
docker-compose logs -f whatsapp
docker-compose logs -f evolution-api
```

## Parar Todos os Serviços

```bash
cd C:/DASH-IGAMING/infrastructure/docker
docker-compose down
```

## Próximos Passos

1. **Integrar Facebook Ads** - Adicionar serviço para extrair métricas
2. **Configurar Automação** - Criar fluxos de recuperação de leads
3. **Implementar Analytics** - Dashboard com gráficos em tempo real
4. **Adicionar Autenticação** - Proteger endpoints com JWT
5. **Deploy Produção** - Configurar VPS ou Kubernetes

## Documentação Externa

- [Refferq](https://github.com/Refferq/Refferq)
- [Evolution API](https://github.com/evolution-foundation/evolution-api)
- [Meta Marketing API](https://developers.facebook.com/docs/marketing-api)
