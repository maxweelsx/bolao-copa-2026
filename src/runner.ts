import * as readline from 'readline';
import { prisma } from './database/prismaClient';
import { redis } from './database/redisClient';
import { mongoClient } from './database/mongoClient';
import { criarUsuario, criarPartida, criarPalpite, buscarPalpitesDaPartida, registrarResultado } from './repositories/userRepository';
import { adicionarPontos, buscarTopRanking } from './repositories/rankingRepository';
import { registrarEvento, buscarUltimosEventos } from './repositories/feedRepository';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function pergunta(texto: string): Promise<string> {
  return new Promise(resolve => rl.question(texto, resolve));
}

function limpar() {
  console.clear();
}

function cabecalho() {
  console.log('========================================');
  console.log('         BOLÃO COPA DO MUNDO 2026       ');
  console.log('========================================\n');
}

async function menu() {
  limpar();
  cabecalho();
  console.log('1. Cadastrar usuário');
  console.log('2. Cadastrar partida');
  console.log('3. Fazer palpite');
  console.log('4. Encerrar partida (admin)');
  console.log('5. Ver painel (ranking + feed)');
  console.log('0. Sair');
  console.log('\n----------------------------------------');
  return pergunta('Escolha uma opção: ');
}

async function cadastrarUsuario() {
  limpar();
  cabecalho();
  console.log('>>> CADASTRAR USUÁRIO\n');
  const nome = await pergunta('Nome: ');
  const email = await pergunta('Email: ');
  try {
    const user = await criarUsuario(nome, email);
    await redis.zadd('ranking:global', 0, nome);
    console.log(`\n✔ Usuário "${user.name}" cadastrado com sucesso! (ID: ${user.id})`);
  } catch (e: any) {
    console.log(`\n✘ Erro: ${e.message}`);
  }
  await pergunta('\nPressione Enter para voltar...');
}

async function cadastrarPartida() {
  limpar();
  cabecalho();
  console.log('>>> CADASTRAR PARTIDA\n');
  const time1 = await pergunta('Time da casa: ');
  const time2 = await pergunta('Time visitante: ');
  console.log('\nHorário de início da partida:');
  const data = await pergunta('Data (DD/MM/AAAA): ');
  const hora = await pergunta('Hora (HH:MM): ');

  const [dia, mes, ano] = data.split('/');
  const [h, min] = hora.split(':');
  const startTime = new Date(Number(ano), Number(mes) - 1, Number(dia), Number(h), Number(min));

  try {
    const partida = await criarPartida(time1, time2, startTime);
    console.log(`\n✔ Partida "${time1} x ${time2}" cadastrada! (ID: ${partida.id})`);
    console.log(`  Início: ${startTime.toLocaleString('pt-BR')}`);
  } catch (e: any) {
    console.log(`\n✘ Erro: ${e.message}`);
  }
  await pergunta('\nPressione Enter para voltar...');
}

async function fazerPalpite() {
  limpar();
  cabecalho();
  console.log('>>> FAZER PALPITE\n');

  const usuarios = await prisma.user.findMany();
  if (usuarios.length === 0) {
    console.log('✘ Nenhum usuário cadastrado.');
    await pergunta('\nPressione Enter para voltar...');
    return;
  }

  console.log('Usuários disponíveis:');
  usuarios.forEach(u => console.log(`  [${u.id}] ${u.name}`));
  const userId = Number(await pergunta('\nID do usuário: '));

  const partidas = await prisma.match.findMany({ where: { homeScore: null } });
  if (partidas.length === 0) {
    console.log('\n✘ Nenhuma partida disponível para palpite.');
    await pergunta('\nPressione Enter para voltar...');
    return;
  }

  console.log('\nPartidas disponíveis:');
  partidas.forEach(p => console.log(`  [${p.id}] ${p.homeTeam} x ${p.awayTeam} — ${new Date(p.startTime).toLocaleString('pt-BR')}`));
  const matchId = Number(await pergunta('\nID da partida: '));

  const partida = partidas.find(p => p.id === matchId);
  if (!partida) {
    console.log('\n✘ Partida não encontrada.');
    await pergunta('\nPressione Enter para voltar...');
    return;
  }

  const golsCasa = Number(await pergunta(`\nGols ${partida.homeTeam}: `));
  const golsVisit = Number(await pergunta(`Gols ${partida.awayTeam}: `));

  try {
    await criarPalpite(userId, matchId, golsCasa, golsVisit);
    const usuario = usuarios.find(u => u.id === userId);
    const msg = `${usuario?.name} fez um palpite no jogo ${partida.homeTeam} x ${partida.awayTeam} (Placar: ${golsCasa}x${golsVisit})`;
    await registrarEvento(msg);
    console.log(`\n✔ Palpite registrado com sucesso!`);
  } catch (e: any) {
    console.log(`\n✘ Erro: ${e.message}`);
  }
  await pergunta('\nPressione Enter para voltar...');
}

async function encerrarPartida() {
  limpar();
  cabecalho();
  console.log('>>> ENCERRAR PARTIDA (ADMIN)\n');

  const partidas = await prisma.match.findMany({ where: { homeScore: null } });
  if (partidas.length === 0) {
    console.log('✘ Nenhuma partida em aberto.');
    await pergunta('\nPressione Enter para voltar...');
    return;
  }

  console.log('Partidas em aberto:');
  partidas.forEach(p => console.log(`  [${p.id}] ${p.homeTeam} x ${p.awayTeam}`));
  const matchId = Number(await pergunta('\nID da partida: '));

  const partida = partidas.find(p => p.id === matchId);
  if (!partida) {
    console.log('\n✘ Partida não encontrada.');
    await pergunta('\nPressione Enter para voltar...');
    return;
  }

  const golsCasa = Number(await pergunta(`\nPlacar final — Gols ${partida.homeTeam}: `));
  const golsVisit = Number(await pergunta(`Placar final — Gols ${partida.awayTeam}: `));

  await registrarResultado(matchId, golsCasa, golsVisit);
  console.log(`\n[Sistema] Resultado oficial: ${partida.homeTeam} ${golsCasa} x ${golsVisit} ${partida.awayTeam}`);

  const palpites = await buscarPalpitesDaPartida(matchId);
  console.log('[Redis] Atualizando pontuações no ranking...');

  for (const palpite of palpites) {
    const acertou = palpite.homeScore === golsCasa && palpite.awayScore === golsVisit;
    const pontos = acertou ? 50 : 0;
    await adicionarPontos(palpite.user.name, pontos);

    if (acertou) {
      const msg = `${palpite.user.name} acertou o placar em cheio e ganhou 50 pontos!`;
      await registrarEvento(msg);
      console.log(`[MongoDB] Evento registrado: "${msg}"`);
    }
  }

  console.log('\n✔ Partida encerrada e pontuações atualizadas!');
  await pergunta('\nPressione Enter para voltar...');
}

async function verPainel() {
  limpar();
  cabecalho();
  console.log('>>> PAINEL GERAL\n');

  const usuarios = await prisma.user.findMany();
  console.log(`[ORM] Total de usuários cadastrados: ${usuarios.length}`);
  usuarios.forEach(u => console.log(`  - ${u.name} (${u.email})`));

  const ranking = await buscarTopRanking();
  console.log('\n[REDIS] --- TOP RANKING GLOBAL ---');
  if (ranking.length === 0) {
    console.log('  Nenhum dado no ranking ainda.');
  } else {
    for (let i = 0; i < ranking.length; i += 2) {
      const pos = i / 2 + 1;
      console.log(`  ${pos}º Lugar: ${ranking[i]} - ${ranking[i + 1]} pontos`);
    }
  }

  const eventos = await buscarUltimosEventos(5);
  console.log('\n[MONGO] --- ÚLTIMAS ATIVIDADES DO FEED ---');
  if (eventos.length === 0) {
    console.log('  Nenhuma atividade registrada ainda.');
  } else {
    for (const e of eventos) {
      const hora = new Date(e.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      console.log(`  - [${hora}] ${e.mensagem}`);
    }
  }

  await pergunta('\nPressione Enter para voltar...');
}

async function main() {
  await mongoClient.connect();

  while (true) {
    const opcao = await menu();

    switch (opcao.trim()) {
      case '1': await cadastrarUsuario(); break;
      case '2': await cadastrarPartida(); break;
      case '3': await fazerPalpite(); break;
      case '4': await encerrarPartida(); break;
      case '5': await verPainel(); break;
      case '0':
        console.log('\nEncerrando sistema...');
        await prisma.$disconnect();
        await redis.quit();
        await mongoClient.close();
        rl.close();
        process.exit(0);
      default:
        console.log('\n✘ Opção inválida!');
        await pergunta('Pressione Enter para continuar...');
    }
  }
}

main().catch(console.error);