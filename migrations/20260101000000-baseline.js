'use strict';
const fs = require('fs');
const path = require('path');

// Baseline: the whole schema as it was in production when migrations were introduced (tables, enums, indexes,
// constraints). Every later schema change goes in its own new migration file.
//   npm run db:migrate:create -- --name add-something
// On a database that already has the tables (e.g. Supabase) this does nothing, it only gets recorded as applied.
module.exports = {
  async up(queryInterface) {
    const [[{ exists }]] = await queryInterface.sequelize.query("SELECT to_regclass('public.users') IS NOT NULL AS exists");
    if (exists) return;
    const sql = fs.readFileSync(path.join(__dirname, 'sql', '20260101000000-baseline.sql'), 'utf8');
    await queryInterface.sequelize.transaction((transaction) => queryInterface.sequelize.query(sql, { transaction }));
  },

  async down() {
    throw new Error('The baseline cannot be undone. Drop and recreate the database instead (npm run db:reset).');
  },
};
