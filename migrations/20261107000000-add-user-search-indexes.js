'use strict';

// Fast "contains" search on customers (name / phone / email). A normal index cannot help `ILIKE '%text%'`, so every
// search read the whole users table. Trigram (pg_trgm) GIN indexes can, and stay fast as the customer list grows.
module.exports = {
  async up(queryInterface) {
    const sql = queryInterface.sequelize;
    await sql.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await sql.query('CREATE INDEX IF NOT EXISTS users_name_trgm_idx ON users USING gin (name gin_trgm_ops)');
    await sql.query('CREATE INDEX IF NOT EXISTS users_phone_trgm_idx ON users USING gin (phone gin_trgm_ops)');
    await sql.query('CREATE INDEX IF NOT EXISTS users_email_trgm_idx ON users USING gin (email gin_trgm_ops)');
    await sql.query('ANALYZE users');
  },

  async down(queryInterface) {
    const sql = queryInterface.sequelize;
    await sql.query('DROP INDEX IF EXISTS users_email_trgm_idx');
    await sql.query('DROP INDEX IF EXISTS users_phone_trgm_idx');
    await sql.query('DROP INDEX IF EXISTS users_name_trgm_idx');
    // the pg_trgm extension is left in place (other objects may use it)
  },
};
