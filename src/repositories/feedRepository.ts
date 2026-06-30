import { mongoDB } from '../database/mongoClient';

export async function registrarEvento(mensagem: string) {
  const col = mongoDB.collection('feed');
  await col.insertOne({ mensagem, timestamp: new Date() });
  console.log(`[MongoDB] Evento registrado: "${mensagem}"`);
}

export async function buscarUltimosEventos(limite = 5) {
  const col = mongoDB.collection('feed');
  return col.find().sort({ timestamp: -1 }).limit(limite).toArray();
}