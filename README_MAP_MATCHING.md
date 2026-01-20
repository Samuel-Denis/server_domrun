# 🗺️ Map Matching API - Guia de Configuração

Este documento explica como configurar e usar a API de Map Matching do Mapbox para corrigir trajetos GPS e alinhá-los com as ruas reais.

## 📋 O que é Map Matching?

O Map Matching é um processo que corrige erros de GPS e alinha os pontos coletados durante uma corrida com as ruas reais do mapa. Isso garante que:

- ✅ Os trajetos fiquem sobre as vias de tráfego
- ✅ Erros de GPS sejam corrigidos automaticamente
- ✅ Os territórios sejam desenhados precisamente
- ✅ A área calculada seja mais precisa

## 🔧 Configuração

### 1. Obter Token do Mapbox

1. Acesse [mapbox.com](https://www.mapbox.com) e crie uma conta (ou faça login)
2. Vá para [Account → Access Tokens](https://account.mapbox.com/access-tokens/)
3. Copie seu **Default Public Token** ou crie um novo token
4. O token deve ter permissões para usar a API de Map Matching

### 2. Configurar Variável de Ambiente

Adicione o token ao seu arquivo `.env`:

```env
MAPBOX_ACCESS_TOKEN=seu_token_aqui
```

**Exemplo:**
```env
MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoibXl1c2VybmFtZSIsImEiOiJjazh...resto_do_token
```

### 3. Verificar Configuração

Após configurar, reinicie o servidor:

```bash
npm run start:dev
```

O sistema irá:
- ✅ Detectar o token automaticamente
- ✅ Habilitar Map Matching se o token estiver presente
- ⚠️ Desabilitar Map Matching (usando pontos originais) se o token não estiver configurado

## 📊 Como Funciona

### Fluxo de Processamento

```
1. Frontend envia trajeto GPS
   ↓
2. Backend recebe pontos brutos
   ↓
3. Map Matching API corrige e alinha pontos
   ↓
4. Pontos corrigidos são salvos no banco
   ↓
5. Território é criado com dados precisos
```

### Exemplo de Correção

**Antes (pontos GPS brutos):**
```
Ponto 1: (-47.8100, -21.1780)  ← Fora da rua
Ponto 2: (-47.8101, -21.1781)  ← Fora da rua
Ponto 3: (-47.8102, -21.1782)  ← Fora da rua
```

**Depois (Map Matching aplicado):**
```
Ponto 1: (-47.8100, -21.1780)  ← Alinhado à rua
Ponto 2: (-47.8100, -21.1780)  ← Alinhado à rua
Ponto 3: (-47.8100, -21.1781)  ← Alinhado à rua
```

## 🎯 Perfis Disponíveis

O Map Matching suporta diferentes perfis de transporte:

- **`walking`** (padrão) - Para caminhadas e corridas
- **`cycling`** - Para ciclismo
- **`driving`** - Para veículos

Atualmente, o sistema usa `walking` como padrão, mas pode ser modificado no código.

## 📈 Níveis de Confiança

O Map Matching retorna um valor de confiança (0.0 a 1.0):

- **> 0.7**: Alta confiança - pontos corrigidos são usados
- **0.3 - 0.7**: Média confiança - pontos corrigidos são usados
- **< 0.3**: Baixa confiança - pontos originais são mantidos

### Logs de Confiança

O sistema registra o nível de confiança nos logs:

```
✅ Map Matching concluído - Confiança: 85.3%
📍 45 pontos originais → 52 pontos corrigidos
```

Se a confiança for baixa:

```
⚠️ Confiança baixa (25.0%) - usando pontos originais
```

## 🔍 Limites da API

### Mapbox Map Matching Limits

- **Gratuito**: 100.000 requisições/mês
- **Pago**: Conforme plano

### Limites por Requisição

- **Máximo de pontos**: 100 pontos por requisição
- **Timeout**: 30 segundos por requisição

Se seu trajeto tiver mais de 100 pontos, considere dividir em múltiplas requisições ou simplificar.

## 🐛 Troubleshooting

### Problema: Map Matching não está funcionando

**Solução:**
1. Verifique se `MAPBOX_ACCESS_TOKEN` está no `.env`
2. Verifique se o token é válido
3. Reinicie o servidor após adicionar o token
4. Verifique os logs: `⚠️ MAPBOX_ACCESS_TOKEN não configurado`

### Problema: Erro 401 (Unauthorized)

**Solução:**
- Token inválido ou expirado
- Token não tem permissão para Map Matching
- Verifique o token no dashboard do Mapbox

### Problema: Erro 422 (Unprocessable Entity)

**Solução:**
- Pontos GPS muito errados (fora do alcance)
- Coordenadas inválidas
- Verifique se os pontos estão em formato correto (latitude, longitude)

### Problema: Timeout

**Solução:**
- Trajeto muito longo (> 100 pontos)
- Conexão lenta
- Considere simplificar o trajeto antes de enviar

## 📝 Exemplo de Uso

### Requisição ao Backend

O Map Matching é aplicado **automaticamente** quando você envia um trajeto:

```bash
POST /runs
{
  "userId": "...",
  "boundary": [
    {
      "latitude": -21.1780,
      "longitude": -47.8100,
      "timestamp": "2026-01-15T10:30:00.000Z"
    },
    // ... mais pontos
  ]
}
```

### Processamento Automático

```typescript
// Backend processa automaticamente:
1. Recebe pontos brutos
2. Aplica Map Matching (se configurado)
3. Corrige pontos
4. Salva pontos corrigidos no banco
```

### Logs de Processamento

```
📥 Recebendo território do frontend:
   - Tipo: LineString (45 pontos)
   - Usuário: denis.tsx
   - Área: Jardim Paulista

🗺️ Aplicando Map Matching para corrigir trajeto...
🔍 Aplicando Map Matching em 45 pontos...
✅ Map Matching concluído - Confiança: 87.5%
📍 45 pontos originais → 48 pontos corrigidos
✅ Trajeto corrigido: 45 → 48 pontos

🛠️  Processando território...
   📍 48 pontos recebidos (LineString)
   ✅ LineString WKT criada
   ...
```

## 🔐 Segurança

**IMPORTANTE**: Nunca exponha seu token Mapbox no frontend!

- ✅ Token deve estar apenas no backend (`.env`)
- ✅ Não commitar `.env` no git
- ✅ Usar variáveis de ambiente em produção

### Arquivo .gitignore

Certifique-se de que `.env` está no `.gitignore`:

```
.env
.env.local
.env.*.local
```

## 💰 Custos

### Plano Gratuito do Mapbox

- 100.000 requisições/mês de Map Matching
- Adequado para desenvolvimento e testes

### Plano Pago

- Conforme seu uso
- Recomendado para produção com muitos usuários

## 📚 Documentação Adicional

- [Mapbox Map Matching API](https://docs.mapbox.com/api/navigation/map-matching/)
- [Mapbox Access Tokens](https://docs.mapbox.com/accounts/guides/tokens/)
- [API Rate Limits](https://docs.mapbox.com/api/overview/#rate-limits)

---

**Última atualização**: Janeiro 2025  
**Versão**: 1.0
