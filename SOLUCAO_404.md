# 🔧 Solução para Erro 404 ao Salvar Territórios

## 📋 Problema Identificado

O frontend está recebendo **404 Not Found** ao tentar salvar territórios. Isso acontece porque:

1. **Endpoint diferente**: O frontend pode estar chamando um endpoint que não existe
2. **Validação muito rigorosa**: Circuitos fechados podem estar sendo rejeitados

## ✅ Correções Implementadas

### 1. Endpoint Alternativo `/api/territories`

Adicionei um controller adicional que aceita requisições em `/api/territories`:

```typescript
@Controller('api/territories')
export class TerritoriesController {
    // Mesma lógica do RunsController
}
```

**Agora funcionam ambos:**
- ✅ `POST /runs` (endpoint original)
- ✅ `POST /api/territories` (novo endpoint para compatibilidade)

### 2. Validação de Circuito Fechado Ajustada

**Antes:** Rejeitava circuitos com primeiro e último ponto iguais

**Agora:** Aceita circuitos fechados e apenas loga a informação:
```typescript
if (latEqual && lngEqual) {
    console.log('ℹ️ Boundary recebido com primeiro e último ponto iguais (circuito fechado)');
    // NÃO rejeita mais - o backend trata automaticamente
}
```

### 3. Tratamento de Erros Melhorado

- Substituído `throw new Error()` por `throw new BadRequestException()` para retornar 400 em vez de 500

## 🔍 Como Verificar

### 1. Verificar qual endpoint o frontend está usando

No código Flutter, procure por:
```dart
final url = Uri.parse('...'); // Qual URL está sendo usada?
```

**Endpoints disponíveis:**
- ✅ `POST http://192.168.0.101:3000/runs`
- ✅ `POST http://192.168.0.101:3000/api/territories`

### 2. Verificar autenticação

O erro 404 pode ser causado por:
- Token JWT inválido ou ausente
- Header `Authorization: Bearer {token}` não enviado

**Headers necessários:**
```
Content-Type: application/json
Authorization: Bearer {seu_token_jwt}
```

### 3. Verificar logs do backend

Quando receber uma requisição, o backend deve logar:
```
📥 Recebendo território do frontend:
   - Tipo: LineString (27 pontos)
   - Usuário: ...
   - Área: ...
```

Se não aparecer este log, a requisição não está chegando ao controller.

## 🐛 Troubleshooting

### Problema: Ainda recebendo 404

**Solução 1**: Verificar se o servidor está rodando
```bash
npm run start:dev
```

**Solução 2**: Verificar o caminho completo da URL
- ❌ `http://192.168.0.101:3000/api/territories/` (barra no final pode causar problema)
- ✅ `http://192.168.0.101:3000/api/territories` (sem barra final)
- ✅ `http://192.168.0.101:3000/runs`

**Solução 3**: Verificar se a porta está correta
- Backend padrão: porta `3000`
- Verifique se o frontend está usando a porta correta

### Problema: Erro 401 (Unauthorized)

**Causa**: Token JWT inválido ou ausente

**Solução**: 
- Verificar se o token está sendo enviado no header `Authorization`
- Verificar se o token ainda é válido (não expirou)
- Fazer login novamente para obter novo token

### Problema: Erro 400 (Bad Request)

**Causa**: Validação falhou

**Verificar**:
- Formato do JSON está correto
- Campos obrigatórios estão presentes
- `timestamp` está presente em cada ponto
- `capturedAt` está presente

## 📝 Exemplo de Requisição Correta

```bash
curl -X POST http://192.168.0.101:3000/api/territories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT_AQUI" \
  -d '{
    "id": "",
    "userId": "uuid-do-usuario",
    "userName": "denis.tsx",
    "userColor": "#FF0000",
    "areaName": "Jardim Paulista",
    "boundary": [
      {
        "latitude": -21.1306783,
        "longitude": -47.7706317,
        "timestamp": "2024-01-15T14:30:00.000Z"
      }
      // ... mais pontos
    ],
    "capturedAt": "2024-01-15T14:35:42.123Z",
    "area": 49362.93
  }'
```

## ✅ Checklist de Verificação

- [ ] Servidor backend está rodando
- [ ] Porta correta (3000 por padrão)
- [ ] URL correta (sem barra final)
- [ ] Header `Authorization` com token válido
- [ ] Header `Content-Type: application/json`
- [ ] JSON está bem formatado
- [ ] Campos obrigatórios presentes
- [ ] `timestamp` presente em cada ponto

## 🎯 Próximos Passos

1. **Testar ambos os endpoints**:
   - `POST /runs`
   - `POST /api/territories`

2. **Verificar logs do backend** para ver se a requisição está chegando

3. **Se ainda der erro**, verificar:
   - Logs completos do backend
   - Network tab do Flutter/Dart para ver a requisição exata
   - Resposta completa do servidor (não apenas status code)

---

**Última atualização**: Janeiro 2025
