'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Create a default staking pool
      await queryInterface.bulkInsert('staking_pools', [
        {
          id: 1,
          name: 'Genesis Pool',
          symbol: 'GEN',
          apr: 10.0,
          duration: 30,
          minStake: 100,
          maxStake: 10000,
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          autoCompound: false,
          earningFrequency: 'daily',
          adminFeePercentage: 1.0,
          lockPeriod: 30,
        },
      ], { transaction });

      // Ensure the staking automatic earnings distribution setting exists and is enabled
      const settings = await queryInterface.sequelize.query(
        `SELECT * FROM settings WHERE \`key\` = 'stakingAutomaticEarningsDistribution'`,
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      if (settings.length === 0) {
        await queryInterface.bulkInsert('settings', [
          {
            key: 'stakingAutomaticEarningsDistribution',
            value: 'true',
            type: 'boolean',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ], { transaction });
      } else {
        await queryInterface.bulkUpdate('settings',
          { value: 'true' },
          { key: 'stakingAutomaticEarningsDistribution' },
          { transaction }
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Error in staking seeder:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.bulkDelete('staking_pools', { id: 1 }, { transaction });
      await queryInterface.bulkDelete('settings', { key: 'stakingAutomaticEarningsDistribution' }, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Error reverting staking seeder:', error);
      throw error;
    }
  }
};