import { createNotification } from "@b/utils/notifications";
import { models, sequelize } from "@b/db";
import { createError } from "@b/utils/error";

export const metadata = {
  summary: "Request Withdrawal from Staking Position",
  description:
    "Initiates a withdrawal request for a specific staking position.",
  operationId: "withdrawStakingPosition",
  tags: ["Staking", "Positions", "Withdrawal"],
  requiresAuth: true,
  parameters: [
    {
      index: 0,
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string" },
      description: "Position ID",
    },
  ],
  responses: {
    200: {
      description: "Withdrawal request submitted successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              position: { type: "object" },
            },
          },
        },
      },
    },
    400: { description: "Invalid request" },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden - Not position owner" },
    404: { description: "Position not found" },
    500: { description: "Internal Server Error" },
  },
};

export default async (data: Handler) => {
  const { user, params, body } = data;
  if (!user?.id) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const { id } = params;

  // Start a transaction
  const transaction = await sequelize.transaction();

  try {
    // Get the position with associated pool data.
    const position = await models.stakingPosition.findOne({
      where: { id },
      include: [
        {
          model: models.stakingPool,
          as: "pool",
        },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!position) {
      await transaction.rollback();
      throw createError({ statusCode: 404, message: "Position not found" });
    }

    // Verify that the position belongs to the user.
    if (position.userId !== user.id) {
      await transaction.rollback();
      throw createError({
        statusCode: 403,
        message: "You don't have access to this position",
      });
    }

    // Ensure the position is not already being withdrawn or completed.
    if (position.status === "PENDING_WITHDRAWAL") {
      await transaction.rollback();
      throw createError({
        statusCode: 400,
        message: "Withdrawal already in progress",
      });
    }

    if (position.status === "COMPLETED") {
      await transaction.rollback();
      throw createError({
        statusCode: 400,
        message: "Position is already withdrawn",
      });
    }

    // Calculate unclaimed earnings
    const unclaimedEarnings = await models.stakingEarningRecord.sum('amount', {
      where: {
        positionId: position.id,
        isClaimed: false,
      },
      transaction,
    });

    const totalWithdrawalAmount = position.amount + unclaimedEarnings;

    // Update user's wallet
    const wallet = await models.wallet.findOne({
      where: { userId: user.id, symbol: position.pool.symbol },
      transaction,
    });

    if (wallet) {
      await wallet.increment('balance', { by: totalWithdrawalAmount, transaction });
    } else {
      await models.wallet.create({
        userId: user.id,
        symbol: position.pool.symbol,
        balance: totalWithdrawalAmount,
      }, { transaction });
    }

    // Mark position as completed
    await position.update({
      status: 'COMPLETED',
      completedAt: new Date(),
    }, { transaction });

    // Mark earnings as claimed
    await models.stakingEarningRecord.update({
      isClaimed: true,
      claimedAt: new Date(),
    }, {
      where: {
        positionId: position.id,
        isClaimed: false,
      },
      transaction,
    });

    // Create a transaction log
    await models.transaction.create({
      userId: user.id,
      symbol: position.pool.symbol,
      amount: totalWithdrawalAmount,
      type: 'STAKING_WITHDRAWAL',
      status: 'COMPLETED',
      fee: 0,
      metadata: {
        positionId: position.id,
        stakedAmount: position.amount,
        earningsClaimed: unclaimedEarnings,
      },
    }, { transaction });


    // Create a notification for the user.
    await createNotification({
      userId: user.id,
      relatedId: position.id,
      type: "system",
      title: "Staking Withdrawal Successful",
      message: `Your withdrawal of ${totalWithdrawalAmount.toFixed(8)} ${position.pool.symbol} was successful.`,
      link: `/staking/positions/${position.id}`,
      actions: [
        {
          label: "View Wallet",
          link: `/wallet`,
          primary: true,
        },
      ],
    });

    // Retrieve the updated position.
    const updatedPosition = await models.stakingPosition.findOne({
      where: { id },
      include: [
        {
          model: models.stakingPool,
          as: "pool",
        },
      ],
      transaction,
    });

    await transaction.commit();

    return {
      success: true,
      message: "Withdrawal request submitted successfully",
      position: updatedPosition,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
