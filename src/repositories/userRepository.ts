import { prisma } from '../database/prismaClient';

export async function criarUsuario(name: string, email: string) {
  return prisma.user.create({ data: { name, email } });
}

export async function criarPartida(homeTeam: string, awayTeam: string, startTime: Date) {
  return prisma.match.create({ data: { homeTeam, awayTeam, startTime } });
}

export async function criarPalpite(userId: number, matchId: number, home: number, away: number) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error('Partida não encontrada');
  if (new Date() >= match.startTime) throw new Error('Prazo encerrado para palpites');
  return prisma.bet.create({ data: { userId, matchId, homeScore: home, awayScore: away } });
}

export async function buscarPalpitesDaPartida(matchId: number) {
  return prisma.bet.findMany({ where: { matchId }, include: { user: true } });
}

export async function registrarResultado(matchId: number, home: number, away: number) {
  return prisma.match.update({
    where: { id: matchId },
    data: { homeScore: home, awayScore: away },
  });
}