# PR Notes

## O que mudou
- CORS em producao agora exige allowlist via `CORS_ORIGINS`.
- Validacao de env exige `CORS_ORIGINS` em producao.
- Queries raw unsafe no seed foram trocadas por `Prisma.sql`.

## Por que mudou
- Evitar fallback inseguro de CORS em producao.
- Garantir validacao explicita das variaveis obrigatorias.
- Remover uso de APIs raw unsafe do Prisma.

## Risco
- Baixo: mudancas de configuracao podem falhar startup se env estiver faltando.

## Como testar
- `npm run start:dev`
- `NODE_ENV=production CORS_ORIGINS="https://a.com" npm run start:prod`
- `npm run prisma:seed` (opcional)

## Arquivos alterados
- `src/config/env.validation.ts`
- `src/main.ts`
- `prisma/seed-completo-usuarios.ts`
- `PR_NOTES.md`

## Comandos de teste
- `npm run start:dev`
- `npm run start:prod`
