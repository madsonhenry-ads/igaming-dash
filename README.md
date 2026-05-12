# DASH-IGAMING

Dashboard/CRM modular para iGaming com integração de Facebook Ads, S2S Postback e automação via WhatsApp.

## Arquitetura

```
┌─────────────┐     ┌─────────────┐
│   Facebook  │────▶│  Dashboard  │
│     Ads     │     │   (Next.js) │
└─────────────┘     └──────┬──────┘
                          │
                    ┌─────┴─────┐
                    │  Click ID │
                    └─────┬─────┘
                          │
              ┌───────────▼──────────┐
              │   Betting House API  │
              └───────────┬──────────┘
                          │
                    ┌─────▼─────┐
                    │  Postback │
                    │   (S2S)   │
                    └─────┬─────┘
                          │
              ┌───────────┴──────────┐
              │                      │
        ┌─────▼─────┐          ┌────▼────┐
        │ Dashboard │          │WhatsApp │
        │  + DB     │          │ Service │
        └───────────┘          └─────────┘
```

## Serviços

| Serviço | Porta | Tecnologia |
|---------|-------|------------|
| Dashboard | 3000 | Next.js, PostgreSQL |
| Postback | 3001 | Fastify, PostgreSQL, Redis |
| WhatsApp | 3002 | Fastify, Evolution API |
| PostgreSQL | 5432 | - |
| Redis | 6379 | - |

## Setup Rápido

### 1. Iniciar Infraestrutura

```bash
cd C:/DASH-IGAMING/infrastructure/docker
docker-compose up -d
```

### 2. Configurar Dashboard (Refferq)

O dashboard já foi clonado. Configure o ambiente:

```bash
cd C:/DASH-IGAMING/dashboard
npm install
```

O arquivo `.env.local` já está configurado com as credenciais do Docker. Se necessário, altere:

```bash
# .env.local já configurado com:
# DATABASE_URL="postgresql://dashigaming:changeme@localhost:5432/dashigaming"
# REDIS_URL="redis://localhost:6379"
# EVOLUTION_API_URL="http://localhost:8080"
```

Gerar o Prisma Client e migrar o schema:

```bash
npm run db:generate
npm run db:push
```

Iniciar o dashboard:

```bash
npm run dev
```

Acesse em: `http://localhost:3000`

### 2. Iniciar Infraestrutura

```bash
cd C:/DASH-IGAMING/infrastructure/docker
docker-compose up -d
```

### 3. Iniciar Microsserviços

```bash
# Postback
cd C:/DASH-IGAMING/services/postback
npm install
npm run dev

# WhatsApp (novo terminal)
cd C:/DASH-IGAMING/services/whatsapp
npm install
npm run dev
```

### 4. Configurar Evolution API

O Docker Compose já inclui o Evolution API. Configure uma instância:

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: changeme" \
  -d '{"instanceName": "dashigaming"}'
```

## Variáveis de Ambiente

```bash
# .env
POSTGRES_PASSWORD=changeme
NEXTAUTH_SECRET=changeme
JWT_SECRET=changeme
WEBHOOK_SECRET=changeme
EVOLUTION_API_KEY=changeme
```

## API Endpoints

### Postback Service (http://localhost:3001)

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/health` | GET | Health check |
| `/api/v1/postback` | POST | Receber evento S2S |
| `/api/v1/postbacks/:clickId` | GET | Listar eventos por click ID |

**Exemplo Postback:**
```bash
curl -X POST http://localhost:3001/api/v1/postback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SECRET" \
  -d '{
    "clickId": "abc123",
    "event": "deposit",
    "amount": 100.50,
    "currency": "BRL",
    "timestamp": "2026-05-10T15:30:00Z",
    "userId": "user_123"
  }'
```

### WhatsApp Service (http://localhost:3002)

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/health` | GET | Health check |
| `/api/v1/send` | POST | Enviar mensagem |
| `/api/v1/send-bulk` | POST | Enviar mensagens em massa |
| `/api/v1/templates` | GET | Listar templates |

## Próximos Passos

1. **Integrar Facebook Ads SDK** - Adicionar serviço para extrair métricas
2. **Configurar Automação** - Criar fluxos de recuperação de leads
3. **Implementar Analytics** - Dashboard com gráficos em tempo real
4. **Adicionar Autenticação** - Proteger endpoints com JWT
5. **Deploy** - Configurar produção com VPS ou Kubernetes

## Documentação

- [Arquitetura](./ARCHITECTURE.md)
- [Refferq](https://github.com/Refferq/Refferq)
- [Evolution API](https://github.com/evolution-foundation/evolution-api)
