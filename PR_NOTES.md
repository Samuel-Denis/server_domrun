# PR Notes

## O que foi feito
- Remocao total de `console.*` no runtime; uso de `Logger` com contexto por classe.
- Rate limit aplicado somente em `POST /auth/login` (5 req/60s por IP).
- Health check `GET /health` com status do DB e retorno seguro.
- Filtro global de exceptions e `request-id` para padronizar respostas.

## Por que foi feito
- Padronizar logs e facilitar debug sem expor segredos.
- Mitigar brute-force no login sem afetar outras rotas de auth.
- Expor sinal simples de saude do banco para monitoramento.

## Como testar localmente
- `npm run build`
- `npm run start:dev`
- `curl -i http://localhost:3000/health`
- `curl -i http://localhost:3000/auth/login`

## Risco / impacto
- Baixo: throttling apenas no login; demais rotas mantidas.
- Health retorna 503 apenas quando DB indisponivel.

## Arquivos alterados
- `src/auth/auth.controller.ts`
- `src/auth/auth.module.ts`
- `src/auth/auth.service.ts`
- `src/battles/gateway/battle.gateway.ts`
- `src/battles/services/battle.service.ts`
- `src/common/filters/http-exception.filter.ts`
- `src/common/middleware/request-id.middleware.ts`
- `src/health/health.controller.ts`
- `src/main.ts`
- `src/runs/runs.controller.ts`
- `src/runs/runs.service.ts`
- `src/runs/services/territory-processing.service.ts`
- `src/runs/services/territory.service.ts`
- `src/users/achievements.service.ts`
- `src/users/users.service.ts`
- `src/weekly-battles/services/champion-run.service.ts`
- `src/weekly-battles/services/weekly-closure.service.ts`
- `src/weekly-battles/services/weekly-room.service.ts`
- `package.json`
- `package-lock.json`
- `PR_NOTES.md`
