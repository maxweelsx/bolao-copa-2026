import { registrarResultado, buscarPalpitesDaPartida } from '../repositories/userRepository';
import { adicionarPontos } from '../repositories/rankingRepository';
import { registrarEvento } from '../repositories/feedRepository';

export async function encerrarPartida(matchId: number, homeScore: number, awayScore: number) {
  console.log(`\n[Sistema] Jogo encerrado! Resultado oficial: Brasil ${homeScore} x ${awayScore} Croácia.`);

  await registrarResultado(matchId, homeScore, awayScore);
  const palpites = await buscarPalpitesDaPartida(matchId);

  console.log('[Redis] Atualizando pontuações no ranking...');

  for (const palpite of palpites) {
    const acertouPlacar = palpite.homeScore === homeScore && palpite.awayScore === awayScore;
    const pontos = acertouPlacar ? 50 : 0;

    await adicionarPontos(palpite.user.name, pontos);

    if (acertouPlacar) {
      const msg = `${palpite.user.name} acertou o placar em cheio e ganhou 50 pontos!`;
      await registrarEvento(msg);
    }
  }
}