# 🎨 PROMPT PARA CRIAÇÃO DE DESIGN NO FIGMA - RUN EMPIRE

## Instruções para o ChatGPT 5 (Designer de UI/UX)

Você é um designer profissional especializado em aplicativos mobile de fitness e gamificação. Preciso que crie um design completo e profissional no Figma para o aplicativo **Run Empire** - uma plataforma de corrida gamificada que combina rastreamento GPS, conquista de territórios e batalhas PvP.

---

## 📱 VISÃO GERAL DO APLICATIVO

**Run Empire** é um aplicativo mobile (iOS/Android) de corrida que transforma exercícios físicos em uma experiência gamificada competitiva. Os usuários correm, conquistam territórios no mapa real, competem em batalhas PvP e participam de ligas semanais.

### Princípios de Design:
- **Motivacional**: Inspira usuários a correrem mais através de gamificação
- **Competitivo**: Visualiza conquistas, rankings e batalhas de forma envolvente
- **Mapa-Cêntrico**: O mapa geográfico é o elemento visual principal
- **Social**: Mostra territórios de outros jogadores e interações
- **Progresso Visual**: XP, níveis, troféus e ligas devem ser claramente visíveis

---

## 🎯 FUNCIONALIDADES PRINCIPAIS

### 1. **AUTENTICAÇÃO E PERFIL**
- Login/Registro (email e senha)
- Perfil do usuário com:
  - Foto de perfil
  - Nome e username
  - Nível atual e barra de XP
  - Troféus e liga atual (Bronze, Prata, Ouro, Cristal, Mestre)
  - Estatísticas: distância total, corridas totais, territórios conquistados
  - Vitórias/Derrotas em batalhas PvP
  - Histórico de corridas

### 2. **CORRIDA E TERRITÓRIOS (TELA PRINCIPAL)**
- **Mapa Interativo** (elemento central):
  - Mapa OpenStreetMap/Mapbox mostrando territórios coloridos
  - Cada território tem cor única do dono
  - Toque em território mostra: dono, área conquistada, data
  - Territórios próprios em destaque (cor do usuário)
  - Territórios inimigos (outros jogadores)
  - Botão de "Iniciar Corrida"
  
- **Durante a Corrida**:
  - Tela de rastreamento GPS em tempo real
  - Mapa mostrando trajeto percorrido
  - Estatísticas em tempo real: distância, tempo, ritmo médio, velocidade
  - Botão "Finalizar Corrida"
  - Alerta quando circuito está sendo fechado (conquista de território)

- **Após a Corrida**:
  - Resumo da corrida (distância, tempo, ritmo, calorias)
  - XP ganho (se conquistou território)
  - Visualização do trajeto no mapa
  - Opção de salvar como corrida simples ou conquistar território

### 3. **SISTEMA DE BATALHAS PVP 1v1**
- **Tela de Batalhas**:
  - Botão "Buscar Oponente" (entrar na fila)
  - Status: "Buscando oponente...", "Batalha encontrada!", "Correndo..."
  - Quando oponente encontrado: mostra nome, nível, liga, foto do oponente
  - Estatísticas comparativas (troféus, vitórias)
  - Botão "Iniciar Corrida"
  
- **Durante a Batalha**:
  - Tela dividida mostrando:
    - Metade superior: seu progresso (distância, pace)
    - Metade inferior: progresso do oponente (atualizado em tempo real)
  - Barra de progresso comparativa
  - Battle Score calculado (distância + pace)
  - Timer da batalha
  
- **Resultado da Batalha**:
  - Tela de vitória/derrota animada
  - Troféus ganhos/perdidos
  - Mudança de liga (se aplicável)
  - Histórico de batalha salvo

### 4. **SISTEMA DE BATALHAS SEMANAIS**
- **Tela de Sala Semanal**:
  - Status da semana atual (dias restantes)
  - Liga da sala (Bronze, Prata, Ouro, Aspirante, Atleta, Pro, Campeão)
  - Ranking dos 20 participantes (posição, nome, foto, pontos, corridas completadas)
  - Sua posição destacada
  - Progresso: "3 de 5 corridas completadas" (mínimo 5 corridas de 5km)
  - Botão "Ver Minhas Corridas Semanais"
  - Botão "Submeter Nova Corrida"
  
- **Tela de Submissão de Corrida Semanal**:
  - Lista de corridas elegíveis (5km completados)
  - Seletor de corrida para submeter
  - Validação anti-cheat automática
  - Pontuação calculada (distância, pace, regularidade)

### 5. **RANKINGS E LIGAS**
- **Ranking Global**:
  - Top 10 jogadores por troféus
  - Card de cada jogador: foto, nome, nível, liga, troféus, vítorias
  - Posição destacada do usuário logado
  
- **Sistema de Ligas**:
  - Visual de liga atual (medalha/ícone)
  - Barra de progresso para próxima liga
  - Lista de todas as ligas (Bronze III → Mestre)
  - Requisitos de troféus para cada liga

### 6. **TERRITÓRIOS CONQUISTADOS**
- **Minhas Conquistas**:
  - Lista ou grid de territórios conquistados
  - Card de cada território: nome, área (m²), data de conquista, mapa em miniatura
  - Estatísticas totais: total de área conquistada, número de territórios
  
- **Mapa Global**:
  - Visão ampla de todos os territórios
  - Filtros: "Meus Territórios", "Todos", por cidade
  - Legenda de cores por jogador

---

## 🎨 DESIGN SYSTEM

### **Cores Principais**
- **Cor Primária**: Azul vibrante (#0083FF) - Energia e movimento
- **Cor Secundária**: Verde (#00C853) - Sucesso e conquista
- **Cor de Alerta**: Laranja (#FF6D00) - Competição
- **Cor de Erro**: Vermelho (#D32F2F)
- **Cor de Vitória**: Dourado (#FFD700) - Troféus e ligas altas
- **Fundo Escuro**: #121212 (Dark mode principal)
- **Fundo Claro**: #F5F5F5 (Cards e elementos elevados)
- **Texto Primário**: #FFFFFF (em dark mode) / #000000 (em light mode)
- **Texto Secundário**: #B0B0B0

### **Gradientes**
- **Vitória**: Gradiente dourado (#FFD700 → #FFA500)
- **Progresso XP**: Gradiente azul-verde (#0083FF → #00C853)
- **Batalha**: Gradiente roxo-vermelho (#9C27B0 → #E91E63)

### **Tipografia**
- **Títulos**: Sans-serif bold (ex: Inter Bold, Poppins Bold)
- **Subtítulos**: Sans-serif semibold
- **Corpo**: Sans-serif regular
- **Números/Estatísticas**: Mono (ex: Roboto Mono) para precisão

### **Componentes Visuais**
- **Cards**: Bordas arredondadas (12-16px), sombra sutil, padding generoso
- **Botões**: 
  - Primário: Fundo sólido colorido, texto branco, 14px de altura
  - Secundário: Borda, fundo transparente
  - FAB (Floating Action Button): Circular para ações principais
- **Barras de Progresso**: Arredondadas, com gradiente animado
- **Badges**: Pequenos chips para ligas, níveis, status

### **Ícones e Ilustrações**
- **Corrida**: Ícone de pessoa correndo, pegadas, linha de chegada
- **Território**: Polígono/área no mapa, bandeira, coroa
- **Batalha**: Espadas cruzadas, troféu, escudo
- **Liga**: Medalhas, estrelas, coroa
- **XP/Nível**: Estrela, diamante, experiência

---

## 📐 ESTRUTURA DE TELAS

### **Bottom Navigation Bar (5 itens)**
1. **🏠 Home** - Mapa principal e início de corrida
2. **🗺️ Territórios** - Minhas conquistas e mapa global
3. **⚔️ Batalhas** - PvP 1v1 e salas semanais
4. **🏆 Ranking** - Rankings globais e ligas
5. **👤 Perfil** - Perfil do usuário e configurações

### **Tela 1: Home (Mapa Principal)**
**Layout:**
- **Header Fixo**:
  - Logo/ícone do app (esquerda)
  - Nível e XP do usuário (centro)
  - Notificações (direita)
  
- **Mapa (Ocupa 70% da tela)**:
  - Controles de zoom
  - Botão "Minha Localização" (FAB no canto)
  - Territórios renderizados como polígonos coloridos
  - Tooltip ao tocar em território
  
- **Barra Inferior Flutuante**:
  - Botão grande "🏃 Iniciar Corrida" (destacado)
  - Botão secundário "📊 Estatísticas Hoje"
  - Indicador de status: "Corrida ativa" (se houver)

### **Tela 2: Perfil**
**Layout em scroll vertical:**
- **Header do Perfil**:
  - Foto de perfil grande (circular, 120px)
  - Nome e username
  - Badge de liga atual (Bronze/Prata/Ouro/etc)
  - Botão "Editar Perfil"
  
- **Estatísticas em Grid (2x3)**:
  - Nível atual (com barra de XP)
  - Troféus total
  - Distância total
  - Corridas totais
  - Territórios conquistados
  - Vitórias PvP
  
- **Seção "Minhas Conquistas"**:
  - Lista de badges/conquistas desbloqueadas
  
- **Seção "Histórico de Corridas"**:
  - Cards de corridas recentes (scroll horizontal ou lista)

### **Tela 3: Batalhas**
**Tab Navigation (2 abas):**
- **Aba 1: Batalhas 1v1**
  - Card grande: "Buscar Oponente"
  - Histórico de batalhas recentes (lista)
  
- **Aba 2: Batalhas Semanais**
  - Card da sala atual:
    - Liga e semana
    - Ranking top 5
    - Sua posição destacada
    - Progresso de corridas (3/5)
  - Histórico de salas anteriores

### **Tela 4: Territórios**
**Tab Navigation (2 abas):**
- **Aba 1: Minhas Conquistas**
  - Grid ou lista de territórios
  - Filtros: "Todos", "Esta Semana", "Este Mês"
  - Total de área conquistada em destaque
  
- **Aba 2: Mapa Global**
  - Mapa com todos os territórios
  - Filtros e busca
  - Legenda de jogadores

### **Tela 5: Ranking**
**Seções em scroll:**
- **Top 10 Global** (por troféus)
  - Cards grandes com foto, nome, liga, troféus
  - Posição destacada do usuário
  
- **Sistema de Ligas**
  - Visual tipo "escada" ou "pirâmide"
  - Cada liga com ícone, nome, requisitos de troféus
  - Liga atual destacada

---

## 🎮 ELEMENTOS GAMIFICADOS

### **Sistema de Níveis**
- Barra de XP circular ou linear
- Animação de "level up" quando sobe de nível
- Badge de nível atual sempre visível
- Próximo nível mostrado (ex: "Level 15 → 16")

### **Sistema de Ligas**
- Medalhas/ícones únicos para cada liga
- Bronze: Bronze, Prata: Prata, Ouro: Dourado, etc.
- Visual de "promoção" quando sobe de liga
- Multiplicador de XP visível para cada liga

### **Troféus**
- Contador grande e destacado
- Efeito visual ao ganhar troféus (confetti, brilho)
- Histórico de troféus ganhos/perdidos

### **Conquistas/Territórios**
- Badge visual para cada território conquistado
- Contador de área total (ex: "12.5 km² conquistados")
- Mapa mostrando domínio territorial

---

## 📱 COMPONENTES ESPECIAIS

### **Card de Território**
- Mapa em miniatura mostrando formato do polígono
- Nome da área
- Área em m² ou km²
- Data de conquista
- Cor do dono
- Badge "Seu Território" se for do usuário

### **Card de Batalha**
- Foto do oponente
- Nome e nível
- Liga do oponente
- Status: "Vitória" (verde), "Derrota" (vermelho), "Empate"
- Troféus ganhos/perdidos
- Data/hora da batalha

### **Card de Corrida**
- Mapa em miniatura do trajeto
- Distância e duração
- Ritmo médio
- Data e hora
- Badge se conquistou território

### **Botão de Corrida**
- Botão grande e destacado
- Ícone de corrida animado
- Texto: "Iniciar Corrida" ou "Continuar Corrida"
- Estado ativo: pulso/animado

---

## 🔄 ANIMAÇÕES E INTERAÇÕES

### **Animações Importantes**
- **Level Up**: Confetti, brilho, texto "Level Up!" animado
- **Conquista de Território**: Expansão do polígono no mapa, coroa aparecendo
- **Vitória em Batalha**: Troféu caindo, confetti
- **Progresso XP**: Barra preenchendo com gradiente animado
- **Loading**: Skeleton screens ou spinners sutis

### **Micro-interações**
- Botões com feedback tátil (haptic)
- Cards com elevação ao tocar
- Swipe para ações rápidas (ex: deletar corrida)
- Pull-to-refresh em listas

---

## 🌓 MODO ESCURO/CLARO

O app deve ter suporte completo para:
- **Dark Mode**: Cores escuras, texto claro, boa legibilidade
- **Light Mode**: Cores claras, texto escuro
- Toggle fácil nas configurações

---

## 📊 MÉTRICAS E ESTATÍSTICAS

### **Visualização de Estatísticas**
- Gráficos de progresso semanal/mensal
- Charts de distância ao longo do tempo
- Heatmap de atividades (calendário)
- Comparativos: "Esta semana vs. Semana passada"

### **Números Destacados**
- Fontes mono para precisão
- Tamanhos variados (maior = mais importante)
- Cores contextualizadas (verde = positivo, vermelho = negativo)

---

## 🎯 PRIORIDADES DE DESIGN

1. **Usabilidade**: Fluxo intuitivo, fácil de navegar
2. **Motivação**: Visual inspirador que motive o usuário a correr
3. **Clareza**: Informações importantes sempre visíveis
4. **Performance Visual**: Animações suaves, sem lag
5. **Acessibilidade**: Contraste adequado, tamanhos de fonte legíveis

---

## 📝 NOTAS IMPORTANTES

- O **mapa** é o elemento visual mais importante - deve ser grande, claro e interativo
- **Gamificação** deve ser visível mas não intrusiva
- **Estatísticas** devem ser fáceis de entender rapidamente
- **Batalhas** devem ter senso de urgência e competitividade
- **Territórios** devem mostrar domínio e conquista de forma satisfatória

---

## 🚀 ENTREGÁVEIS ESPERADOS

1. **Sistema de Design Completo**:
   - Paleta de cores
   - Tipografia
   - Componentes reutilizáveis (botões, cards, inputs)
   - Ícones customizados

2. **Todas as Telas Principais**:
   - Home (Mapa)
   - Perfil
   - Batalhas (1v1 e Semanais)
   - Territórios
   - Ranking

3. **Fluxos de Usuário**:
   - Login/Registro
   - Iniciar e finalizar corrida
   - Buscar oponente e batalhar
   - Conquistar território

4. **Estados Especiais**:
   - Loading
   - Erro
   - Vazio (sem dados)
   - Sucesso (animações)

5. **Componentes Interativos**:
   - Prototipagem de navegação
   - Animações principais
   - Transições entre telas

---

**Por favor, crie um design moderno, profissional e altamente gamificado que inspire os usuários a correrem mais e competirem. Foque em um visual único que diferencie o Run Empire de outros apps de fitness tradicionais.**

---

*Este prompt foi criado especificamente para o ChatGPT 5 criar um layout completo e profissional no Figma para o aplicativo Run Empire.*
