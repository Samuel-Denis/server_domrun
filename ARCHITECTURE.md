# Arquitetura

## Visao geral
Backend em NestJS, organizado por modulos de dominio. Controllers expõem endpoints, Services concentram regras de negocio, e Repositories fazem acesso ao banco via Prisma/PostGIS. Integracoes externas ficam em services dedicados.

## Padroes adotados
- Modularizacao por dominio (runs, users, battles, weekly-battles, auth).
- Controller -> Service -> Repository para separar API, negocio e dados.
- DTOs para validacao/contrato de entrada e saida.
- Helpers reutilizaveis em `src/common` para evitar duplicacao (ex: GIS).

## Onde ficam regras de negocio
Em `src/**/services` e `src/**.service.ts`. Calculos de territorio e logica de batalha ficam nos services do dominio.

## Onde ficam queries complexas
Em `src/**/repository.ts` e services de processamento que montam SQL/Prisma com PostGIS (ex: `src/runs/runs.repository.ts`, `src/runs/services/territory-processing.service.ts`).

## Decisoes importantes
- PostGIS para operacoes geoespaciais (buffer, intersect, union).
- WKT/GeoJSON como formatos de troca para geometria.
- Separacao de calculo (services) e persistencia (repositories).
