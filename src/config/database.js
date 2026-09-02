import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const pool = {
  max: 5,
  min: 0,
  acquire: 30000,
  idle: 10000,
};

const useSsl = process.env.DB_SSL !== 'false'
  && (process.env.DATABASE_URL || process.env.DB_SSL === 'true');

const dialectOptions = useSsl
  ? { ssl: { require: true, rejectUnauthorized: false } }
  : undefined;

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    pool,
    dialectOptions,
  })
  : new Sequelize(
    process.env.DB_NAME || 'zyra',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || '123',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: false,
      pool,
      dialectOptions,
    },
  );

export default sequelize;
