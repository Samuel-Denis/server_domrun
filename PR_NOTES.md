# PR Notes

## O que mudou
- Logs principais migrados para `Logger` do Nest em pontos criticos.
- Filtro global de exceptions padroniza respostas e inclui `requestId`.
- Middleware de `request-id` adiciona `x-request-id` para rastreio.
- Rate-limit aplicado nos endpoints de auth (10 req/min).
- Endpoint `GET /health` com status do DB.

## Impacto
- Respostas de erro agora incluem `requestId` e formato consistente.
- Auth tem limite de requisicoes por minuto (evita abuso).
- Health check permite monitorar disponibilidade do banco.

## Como testar
- `npm run start:dev`
- `curl -i http://localhost:3000/health`
- `curl -i http://localhost:3000/auth/login` (ver header `x-request-id`)
- Forcar erro para validar response do filtro (ex: rota inexistente)

## Arquivos alterados
- `src/main.ts`
- `src/common/filters/http-exception.filter.ts`
- `src/common/middleware/request-id.middleware.ts`
- `src/auth/auth.module.ts`
- `src/auth/auth.controller.ts`
- `src/health/health.controller.ts`
- `src/weekly-battles/services/weekly-room.service.ts`
- `src/runs/runs.service.ts`
- `src/runs/runs.controller.ts`
- `package.json`
- `package-lock.json`
- `PR_NOTES.md`

## Comandos de teste
- `npm run start:dev`
