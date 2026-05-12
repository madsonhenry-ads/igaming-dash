# DASH-IGAMING - Arquitetura Modular

## Visão Geral

Dashboard/CRM para iGaming com arquitetura de microsserviços.

```
C:/DASH-IGAMING/
├── dashboard/              # Refferq - Interface visual (Next.js)
├── services/
│   ├── postback/          # S2S Postback Service (Fastify)
│   └── whatsapp/          # Evolution API Integration
├── shared/
│   ├── types/             # TypeScript types compartilhados
│   └── utils/             # Utilitários comuns
├── infrastructure/
│   ├── docker/            # Docker Compose
│   └── nginx/             # Gateway API
└── docs/                  # Documentação
```

## Componentes

| Serviço | Porta | Responsabilidade |
|---------|-------|------------------|
| Dashboard | 3000 | UI, gestão de afiliados, métricas |
| Postback | 3001 | Recebe S2S events, atribui conversões |
| WhatsApp | 3002 | Automação de mensagens, recuperação |

## Fluxo de Dados

```
Facebook Ads -> Click ID -> Dashboard
                      ↓
              Betting House
                      ↓
              Postback (S2S)
                      ↓
              Dashboard + WhatsApp
```
