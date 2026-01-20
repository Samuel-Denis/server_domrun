# 🌱 Script de Seed - Dados Fictícios

Este script gera dados fictícios no banco de dados para facilitar testes do frontend.

## 📋 O que é criado

- **5 usuários** com dados completos
- **6 conquistas** padrão
- **11 territórios** distribuídos entre os usuários
- **43 corridas** com pontos de trajeto
- **21 conquistas de usuários** (alguns completados, outros em progresso)
- **23 posts** (fotos e vídeos) com curtidas

## 🚀 Como usar

### Executar o seed:

```bash
npm run seed
```

### Limpar e popular novamente:

O script **limpa automaticamente** todos os dados existentes antes de popular. Cuidado ao usar em produção!

## 👥 Usuários criados

Todos os usuários têm a senha: `senha123`

1. **speedylucas** (lucas@example.com) - Nível 24
2. **maria_corredora** (maria@example.com) - Nível 18
3. **joao_runs** (joao@example.com) - Nível 15
4. **ana_runner** (ana@example.com) - Nível 20
5. **pedro_speed** (pedro@example.com) - Nível 12

## 🏆 Conquistas criadas

1. **Primeiros Passos** - Corra 3km em uma sessão
2. **Maratonista** - Corra 10km em uma sessão
3. **Explorador** - Complete 10 corridas
4. **Viajante** - Domine território em outra cidade
5. **Campeão** - Conquiste 5 territórios
6. **Frequente** - Corra 7 dias consecutivos

## 📊 Dados gerados

- **Corridas**: Cada usuário tem 5-15 corridas com dados realistas
- **Pontos de trajeto**: Cada corrida tem 10-30 pontos GPS
- **Territórios**: Cada usuário tem 1-3 territórios
- **Posts**: Cada usuário tem 2-8 posts (fotos e vídeos)
- **Curtidas**: Posts têm curtidas aleatórias de outros usuários

## ⚠️ Aviso

Este script **DELETA TODOS OS DADOS EXISTENTES** antes de popular. Use apenas em desenvolvimento!
