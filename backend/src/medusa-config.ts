// Configuration block for the core commerce engine
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL ?? `mysql://${process.env.DB_USER ?? 'root'}:${process.env.DB_PASSWORD ?? ''}@${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? '3306'}/${process.env.DB_NAME ?? 'marketplace_db'}`,
    redisUrl: process.env.REDIS_URL ?? `redis://${process.env.REDIS_HOST ?? 'localhost'}:${process.env.REDIS_PORT ?? '6379'}`,
    jwtSecret: process.env.JWT_SECRET ?? 'default_jwt_secret',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'default_jwt_refresh_secret',
    jwtExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '7d',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
  plugins: [],
};

export default config;
