📘 Regras Oficiais — Ligas e Batalhas Semanais (com inscrição 24h)
1) Conceitos principais
1.1 Ligas (tabela League)

Ligas são registros no banco, para permitir recompensas/escudos/temas e balanceamento por liga.

Progressão esportiva:

Starter

Ritmo

Cadência

Endurance

Atleta

Elite

Imortal (endgame, fora de salas)

✅ Imortal não participa de salas semanais.

2) Calendário semanal (muito importante)

O sistema tem 2 períodos fixos por semana:

✅ 2.1 Período de inscrição + processamento

🗓️ Segunda 00:00 → Terça 00:00 (24h)

Nesse período:

o sistema processa a semana anterior

o usuário se inscreve para competir na próxima semana

✅ 2.2 Período de competição (corridas válidas)

🗓️ Terça 00:00 → Domingo 23:59

Nesse período:

corridas são aceitas para pontuação semanal

ranking corre normalmente

📌 Timezone oficial: America/Sao_Paulo

3) Semana / "Season"

Cada semana tem um identificador:

weekKey = "YYYY-Www" (ex: 2026-W03)

seasonNumber e weekNumber também existem para auditoria

4) Inscrição (obrigatória)
4.1 Regra

Para participar da semana, o usuário precisa se inscrever durante:
🗓️ Segunda 00:00 → Terça 00:00

4.2 Consequência de não se inscrever

Se não se inscrever:

não entra em sala

não pontua naquela semana

não sobe/desce naquela semana (porque não competiu)

5) Criação das salas (Starter → Elite)
5.1 Quem entra em sala

Apenas ligas onde isChampion=false (Starter até Elite)

5.2 Tamanho

Cada sala possui até 20 jogadores

Se houver mais de 20 inscritos na mesma liga:

criar salas múltiplas com roomNumber = 1,2,3...

5.3 Quando as salas são criadas

🗓️ Terça 00:00

sistema cria as WeeklyRoom da semana atual

distribui os inscritos

cria WeeklyRoomParticipant para cada usuário

6) Corridas (válidas apenas no período competitivo)
6.1 Quando uma corrida conta

Uma corrida só é elegível para o semanal se:

foi feita/submetida dentro de terça 00:00 → domingo 23:59

o usuário está inscrito e dentro de uma sala ativa

6.2 O que é "corrida válida"

Corrida válida é a que passa nas regras:

distância mínima

pace permitido

anti-cheat (ou suspeita com multiplicador, mas não invalidada)

No banco:

válida: isValid = true

inválida: isValid = false (não conta)

7) Regras de contagem (para evitar grind)
7.1 Máximo 2 corridas por dia contam

Para cada participante e cada dia (dayKey):

apenas as 2 maiores pontuações do dia contam (countedDay=true)

7.2 Apenas as 5 melhores da semana contam

Depois de aplicar a regra acima:

o sistema seleciona as 5 maiores da semana (countedWeek=true)

a pontuação semanal é a soma dessas 5

8) Pontuação por corrida (0–1000)

Cada corrida válida tem:

ScoreBase = PaceScore (0–650) + DistanceScore (0–200) + SmoothnessScore (0–150)
finalScore = floor(ScoreBase × multiplier)

8.1 PaceScore (normalizado por liga)

Cada liga tem paceTopSecKm e paceBaseSecKm

Caminhada deve ser competitiva em Starter/Ritmo

Anti-smurf para ligas baixas:

se existir smurfCapSecKm, paces mais rápidos que o cap são "capados" no cálculo

8.2 DistanceScore

distância mínima: 4.5km

5km dá máximo

acima de 5km não aumenta

8.3 SmoothnessScore

mede estabilidade do ritmo (segmentos de 500m)

ajuda a premiar consistência e detectar padrões suspeitos

9) Anti-cheat (flags + multiplicador)

A corrida pode:

ser inválida (fraude clara)

ou ser válida com penalidade via multiplicador (GPS ruim, comportamento suspeito)

Campos:

flags, multiplier, invalidReason

Exemplo:

1 flag → 0.9

2 flags → 0.75

3+ flags → inválida

10) Elegibilidade por número de corridas válidas

A regra é baseada em corridas válidas, não em tentativas.

≥ 3 válidas: compete normalmente (pode subir / ficar / descer)

1–2 válidas:

não pode ser promovido

só pode ser rebaixado se ficar no bottom 4

0 válidas:

rebaixa automático, exceto Starter

11) Resultado por sala (20 jogadores)

Após o fechamento:

🟢 Top 4: promovidos (se ≥3 válidas)

🟡 5º–16º: permanecem

🔴 Bottom 4: rebaixados (se ≥3 válidas)

regras de elegibilidade (seção 10) se aplicam

Desempate:

pontuação final (pontos + bônus)

melhor corrida (maior finalScore entre as contadas)

pace médio top5 (se disponível)

submittedAt (último)

12) Processamento da semana (segunda-feira)

🗓️ Segunda 00:00 → Terça 00:00

Durante esse período o sistema:

fecha definitivamente a semana anterior

recalcula top2/dia e top5/semana

calcula bônus de consistência

define ranking final e promove/rebaixa

atualiza liga do usuário (para ele já se inscrever na liga correta)

✅ A liga é atualizada antes da inscrição:

o usuário vê sua nova liga na segunda e se inscreve nela.

👑 13) Liga Imortal (fora de salas)
13.1 Corridas válidas (mesmo período)

Imortal também considera corridas válidas terça → domingo.

13.2 Ganho de troféus

Cada corrida válida gera troféus:

sugestão segura: trophiesEarned = clamp(floor(finalScore/25), 10, 60)

13.3 Processamento semanal Imortal (segunda)

Na segunda:

soma trophiesEarnedWeek

conta validRunsCount

se < 3, aplica trophiesPenaltyWeek

se depois disso trophies < 3000, rebaixa para Elite

grava ChampionWeeklySummary

14) Resumo rápido (pra time)

Inscrição: segunda → terça

Competição: terça → domingo

Contagem: top 2 por dia + top 5 na semana

Precisa de ≥3 corridas válidas pra competir completo

Imortal é fora de sala e precisa manter ≥3000 troféus + ≥3 corridas válidas

---

## ⚠️ DIFERENÇAS ENCONTRADAS ENTRE REGRAS E IMPLEMENTAÇÃO

### 🔴 Diferenças Críticas

#### 1. **Sistema de Inscrição Manual (Seção 4)**
- **Regra esperada**: Usuário precisa se inscrever manualmente durante Segunda 00:00 → 23:59
- **Implementado**: Sistema automático - todos os usuários da liga são automaticamente adicionados às salas quando elas são criadas
- **Impacto**: Usuários não podem optar por não participar da semana - são sempre incluídos automaticamente

#### 2. **Timing de Criação de Salas (Seção 5.3)**
- **Regra esperada**: Salas criadas na **Terça 00:00**, após período de inscrição
- **Implementado**: Salas criadas na **Segunda 00:00** (no mesmo cron que fecha semana anterior)
- **Impacto**: As salas são criadas antes do período de inscrição terminar, o que conflita com a lógica de inscrição manual

#### 3. **Período de Competição / Validação de Datas (Seção 2.2 e 6.1)**
- **Regra esperada**: Corridas válidas apenas de **Terça 00:00 → Domingo 23:59**
- **Implementado**: O código usa `getCurrentWeekRange()` que retorna **Segunda 00:00 → Domingo 23:59** (semana completa)
- **Impacto**: Corridas submetidas na segunda-feira podem ser aceitas incorretamente

#### 4. **Validação de Período ao Submeter Corrida (Seção 6.1)**
- **Regra esperada**: Sistema deve validar se corrida foi feita dentro do período competitivo (Terça-Domingo)
- **Implementado**: Não há validação explícita do período quando `submitRun()` é chamado - apenas verifica se usuário está em sala ativa
- **Impacto**: Corridas feitas fora do período podem ser aceitas

#### 5. **Fórmula de Troféus Imortal (Seção 13.2)**
- **Regra esperada**: `trophiesEarned = clamp(floor(finalScore/25), 10, 60)` (divisor 25, mínimo 10, máximo 60)
- **Implementado**: `floor(finalScore / 20)` (divisor 20, sem clamp, sem mínimo/máximo)
- **Impacto**: Troféus podem ser maiores ou menores que o esperado

### 🟡 Diferenças Menores

#### 6. **Desempate em Ranking (Seção 11)**
- **Regra esperada**: Desempate por: 1) pontuação final, 2) melhor corrida, 3) pace médio top5, 4) submittedAt (último)
- **Implementado**: Ordenação apenas por `totalPoints DESC, consistencyBonus DESC`
- **Impacto**: Empates podem não ser resolvidos corretamente

#### 7. **Período de Semana vs Período Competitivo**
- **Regra esperada**: Semana técnica é Segunda-Domingo, mas período competitivo é Terça-Domingo
- **Implementado**: `getCurrentWeekRange()` retorna Segunda-Domingo (usa lógica padrão ISO)
- **Impacto**: Confusão entre semana técnica e período de competição

---

## 📝 RECOMENDAÇÕES PARA CORREÇÃO

1. **Criar sistema de inscrição manual**:
   - Novo endpoint: `POST /weekly-battles/enroll` (disponível Segunda 00:00 → 23:59)
   - Criar tabela/modelo de inscrições (ex: `WeeklyEnrollment`)
   - Modificar `createWeeklyRooms()` para usar apenas usuários inscritos

2. **Separar cron jobs**:
   - **Segunda 00:00 → 23:59**: Fechar semana anterior + processar Imortal + período de inscrições para próxima semana
   - **Terça 00:00**: Criar novas salas apenas com inscritos e iniciar nova semana de corrida

3. **Ajustar período competitivo**:
   - Criar `getCompetitionWeekRange()` que retorna Terça 00:00 → Domingo 23:59
   - Validar período em `submitRun()` antes de aceitar corrida

4. **Corrigir fórmula de troféus Imortal**:
   - Implementar `clamp(floor(finalScore/25), 10, 60)` no `champion-run.service.ts`

5. **Implementar desempate completo**:
   - Adicionar lógica de desempate na ordenação do ranking
