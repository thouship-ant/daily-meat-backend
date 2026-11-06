'use strict';

// The admin's reply shown to the customer when a support ticket is resolved or closed
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('support_tickets', 'admin_reply', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('support_tickets', 'replied_at', { type: Sequelize.DATE, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('support_tickets', 'replied_at');
    await queryInterface.removeColumn('support_tickets', 'admin_reply');
  },
};
