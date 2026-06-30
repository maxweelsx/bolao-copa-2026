# Bolão Copa do Mundo 2026

Sistema acadêmico que implementa o conceito de **persistência poliglota**, integrando três tecnologias de banco de dados diferentes em um único sistema, cada uma responsável por um tipo específico de dado, simulando a arquitetura de plataformas de alto desempenho do mercado.

---

## Sobre o projeto

A Copa do Mundo de 2026 atrai milhões de torcedores conectados simultaneamente. Em sistemas de grande escala, como um bolão oficial, um único banco de dados não é capaz de lidar de forma eficiente com integridade relacional, consultas massivas em tempo real e logs de auditoria flexíveis ao mesmo tempo.

Este projeto resolve esse problema combinando três bancos de dados, cada um especializado em uma função:

| Tecnologia | Tipo | Responsabilidade no sistema |
|---|---|---|
| **PostgreSQL** (via Prisma ORM) | Relacional | Cadastro de usuários, partidas e palpites, com integridade referencial e regras de unicidade |
| **Redis** | Em memória | Ranking global de pontuação em tempo real, usando sorted sets |
| **MongoDB** | NoSQL orientado a documentos | Feed de atividades do sistema, com estrutura flexível para diferentes tipos de eventos |

---

## Tecnologias utilizadas

- **Linguagem:** TypeScript (Node.js)
- **ORM:** Prisma 7
- **Banco relacional:** PostgreSQL 15
- **Banco em memória:** Redis 7
- **Banco de documentos:** MongoDB 7
- **Containerização:** Docker e Docker Compose
- **Driver Redis:** ioredis
- **Driver MongoDB:** mongodb (driver oficial)

---

## Arquitetura do projeto

O projeto segue uma arquitetura em camadas, separando responsabilidades:

```
src/
├── database/          → Camada de conexão (clients de cada banco)
├── repositories/       → Camada de repositórios (consultas isoladas por tecnologia)
├── services/            → Camada de serviços (lógica de negócio que orquestra os 3 bancos)
└── runner.ts            → Script de execução (menu interativo principal)
```

### Fluxo de dados

```
runner.ts (interface)
      │
      ▼
services/ (orquestra a lógica de negócio)
      │
      ▼
repositories/ (isola as consultas de cada banco)
      │
      ▼
database/ (mantém a conexão ativa com cada tecnologia)
```

---

## Pré-requisitos

Antes de começar, você precisa ter instalado:

- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** — para rodar os três bancos de dados em containers
- **[Node.js 18 ou superior](https://nodejs.org/)** — para executar o projeto TypeScript
- **[Git](https://git-scm.com/)** — para clonar o repositório

Para verificar se já tem tudo instalado, rode no terminal:

```bash
docker --version
node --version
git --version
```

---

## Como rodar o projeto do zero

### Passo 1 — Clone o repositório

```bash
git clone https://github.com/SEU_USUARIO/bolao-copa-2026.git
cd bolao-copa-2026
```

### Passo 2 — Instale as dependências do projeto

```bash
npm install
```

Esse comando instala todas as bibliotecas necessárias: Prisma, ioredis, mongodb e o TypeScript.

### Passo 3 — Abra o Docker Desktop

Certifique-se de que o Docker Desktop está aberto e com o status **"Engine running"** antes de prosseguir.

### Passo 4 — Suba os bancos de dados

```bash
docker-compose up -d
```

Esse comando inicializa três containers isolados:

| Container | Porta | Banco |
|---|---|---|
| bolao-postgres | 5432 | PostgreSQL |
| bolao-redis | 6379 | Redis |
| bolao-mongo | 27017 | MongoDB |

Para confirmar que os três estão rodando:

```bash
docker ps
```

Você deve ver os três containers com status **Up**.

### Passo 5 — Crie as tabelas no banco relacional

```bash
npx prisma migrate dev --name init
npx prisma generate
```

O primeiro comando cria as tabelas `User`, `Match` e `Bet` no PostgreSQL com base no arquivo `prisma/schema.prisma`. O segundo gera o client TypeScript do Prisma usado no código.

### Passo 6 — Execute o sistema

```bash
npx ts-node src/runner.ts
```

Um menu interativo vai aparecer no terminal.

---

## Como usar o sistema

Ao executar, você verá o seguinte menu:

```
========================================
       BOLÃO COPA DO MUNDO 2026
========================================

  1. Cadastrar usuário
  2. Cadastrar partida
  3. Fazer palpite
  4. Encerrar partida (admin)
  5. Ver painel geral
  0. Sair
----------------------------------------
Escolha uma opção:
```

### Fluxo recomendado para testar o sistema

1. **Opção 1** — Cadastre dois ou três usuários
2. **Opção 2** — Cadastre uma partida (use um horário futuro para conseguir apostar)
3. **Opção 3** — Faça um palpite com cada usuário para essa partida
4. **Opção 4** — Encerre a partida informando o placar final
5. **Opção 5** — Veja o painel geral, com o ranking atualizado e o feed de atividades

---

## Regras de negócio implementadas

| Regra | Descrição | Onde está implementada |
|---|---|---|
| Bloqueio de palpites | Um palpite só pode ser feito até o horário de início da partida | `userRepository.ts`, função `criarPalpite` |
| Unicidade de palpite | Cada usuário só pode ter um palpite por partida | Chave única composta no `schema.prisma` (`@@unique([userId, matchId])`) |
| Ranking ordenado | A pontuação é mantida ordenada em tempo real usando sorted sets | `rankingRepository.ts`, comandos `zincrby` e `zrevrange` |
| Feed polimórfico | O feed aceita diferentes tipos de eventos sem estrutura rígida | `feedRepository.ts`, documentos MongoDB com campo `tipo` dinâmico |

---

## Como visualizar os dados em cada banco

### PostgreSQL

Via terminal:
```bash
docker exec -it bolao-postgres psql -U bolao -d bolao_copa -c "SELECT * FROM \"User\";"
```

Via interface gráfica (Prisma Studio):
```bash
npx prisma studio
```
Abre automaticamente em `http://localhost:5555`

### Redis

Via terminal:
```bash
docker exec -it bolao-redis redis-cli ZREVRANGE ranking:global 0 -1 WITHSCORES
```

### MongoDB

Via terminal:
```bash
docker exec -it bolao-mongo mongosh --eval "db.getSiblingDB('bolao_copa').feed.find().sort({timestamp:-1}).pretty()"
```

---

## Como parar o projeto

Para parar os containers sem apagar os dados:
```bash
docker-compose stop
```

Para parar e remover os containers (mantendo os dados salvos em volumes):
```bash
docker-compose down
```

Para apagar os containers **e todos os dados**:
```bash
docker-compose down -v
```

---

## Como limpar os dados manualmente

Caso queira reiniciar os dados sem remover os containers:

```bash
docker exec -it bolao-postgres psql -U bolao -d bolao_copa -c "TRUNCATE TABLE \"Bet\", \"User\", \"Match\" RESTART IDENTITY CASCADE;"
docker exec -it bolao-redis redis-cli FLUSHALL
docker exec -it bolao-mongo mongosh --eval "db.getSiblingDB('bolao_copa').feed.deleteMany({})"
```

---

## Estrutura completa de arquivos

```
bolao-copa-2026/
├── docker-compose.yml          → Define os 3 containers (PostgreSQL, Redis, MongoDB)
├── prisma.config.ts            → Configuração de conexão do Prisma 7
├── package.json                → Dependências e scripts do projeto
├── tsconfig.json                → Configuração do compilador TypeScript
├── README.md                    → Este arquivo
│
├── prisma/
│   ├── schema.prisma            → Modelagem das tabelas (User, Match, Bet)
│   └── migrations/              → Histórico de alterações no banco relacional
│
└── src/
    ├── database/
    │   ├── prismaClient.ts      → Inicializa a conexão com o PostgreSQL
    │   ├── redisClient.ts       → Inicializa a conexão com o Redis
    │   └── mongoClient.ts       → Inicializa a conexão com o MongoDB
    │
    ├── repositories/
    │   ├── userRepository.ts    → Consultas e regras do banco relacional
    │   ├── rankingRepository.ts → Comandos de sorted sets do Redis
    │   └── feedRepository.ts    → Inserções e buscas no MongoDB
    │
    ├── services/
    │   └── matchService.ts      → Orquestra os 3 bancos ao encerrar uma partida
    │
    └── runner.ts                 → Menu interativo principal do sistema
```

---

## Modelagem do banco relacional

```
User
├── id        (PK, auto increment)
├── name
└── email     (único)

Match
├── id          (PK, auto increment)
├── homeTeam
├── awayTeam
├── startTime
├── homeScore   (nulo até a partida ser encerrada)
└── awayScore   (nulo até a partida ser encerrada)

Bet
├── id          (PK, auto increment)
├── userId      (FK → User)
├── matchId     (FK → Match)
├── homeScore
├── awayScore
└── @@unique([userId, matchId])  ← garante 1 palpite por usuário por partida
```

---

## Autor

Maxwel Mota e Silas Rafael
