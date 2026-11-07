'use strict';

// Pre-defined push notification plans: a message plus the dates and the IST time range it goes out in.
// The server picks one send time inside the range each day (so it does not always land on the same minute).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('scheduled_notifications', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: false },
      body: { type: Sequelize.TEXT, allowNull: false },
      audience: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ALL' }, // ALL | INACTIVE
      inactive_days: { type: Sequelize.INTEGER, allowNull: true },
      start_date: { type: Sequelize.DATEONLY, allowNull: false }, // IST dates, inclusive
      end_date: { type: Sequelize.DATEONLY, allowNull: false },
      window_start: { type: Sequelize.STRING(5), allowNull: false }, // 'HH:mm' IST
      window_end: { type: Sequelize.STRING(5), allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      last_sent_on: { type: Sequelize.DATEONLY, allowNull: true },
      last_sent_count: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    // The Diwali "Evening nudge (8-9 PM IST)". Diwali 2026 is on 8 Nov: the week before asks customers to order
    // today, and the evening before (7 Nov) says tomorrow is delivery-only. Edit the dates in the admin app.
    const now = new Date();
    await queryInterface.bulkInsert('scheduled_notifications', [
      {
        name: 'Schedule - 2',
        title: 'Diwali week, order today ⏰',
        body: "We're not accepting orders on Diwali. Book your fresh chicken and mutton now.",
        audience: 'ALL',
        start_date: '2026-11-02',
        end_date: '2026-11-06',
        window_start: '20:00',
        window_end: '21:00',
        is_active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Schedule - 1',
        title: 'Celebrate with a feast 🍖🪔',
        body: 'Tomorrow is delivery-only for Diwali. Order tonight so your table is ready.',
        audience: 'ALL',
        start_date: '2026-11-07',
        end_date: '2026-11-07',
        window_start: '20:00',
        window_end: '21:00',
        is_active: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('scheduled_notifications');
  },
};
