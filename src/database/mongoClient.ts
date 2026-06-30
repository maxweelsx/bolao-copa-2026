import { MongoClient } from 'mongodb';
export const mongoClient = new MongoClient('mongodb://localhost:27017');
export const mongoDB = mongoClient.db('bolao_copa');