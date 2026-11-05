// Connection used by sequelize-cli (migrations). Reads DATABASE_URL from .env, like the app does.
//   Local docker:  DATABASE_URL=postgres://postgres:postgres@localhost:5433/daily_meat
//   Supabase:      the pooler URL (use the session-mode port 5432 for migrations, not 6543)
require('dotenv').config();

const url = process.env.DATABASE_URL;
const isLocal = process.env.DB_SSL
  ? process.env.DB_SSL === 'false'
  : /@(localhost|127\.0\.0\.1|host\.docker\.internal|db)[:/]/.test(url || '');

module.exports = {
  url,
  dialect: 'postgres',
  logging: false,
  dialectOptions: isLocal ? {} : { ssl: { require: true, rejectUnauthorized: false } },
};
