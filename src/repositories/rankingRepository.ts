import { redis } from '../database/redisClient';

export async function adicionarPontos(nomeUsuario: string, pontos: number) {
  await redis.zincrby('ranking:global', pontos, nomeUsuario);
}

export async function buscarTopRanking(top = 10) {
  return redis.zrevrange('ranking:global', 0, top - 1, 'WITHSCORES');
}