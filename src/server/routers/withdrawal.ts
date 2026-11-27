import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { logger } from '@/server/observability/logger';
import {
  countPendingWithdrawals,
  listWithdrawalRequests,
  markWithdrawalRefunded,
} from '@/server/services/withdrawal';
import { permissionProcedure, router } from '@/server/trpc';

/** Backoffice de los arrepentimientos: la Productora devuelve el dinero a mano. */
export const withdrawalRouter = router({
  list: permissionProcedure('withdrawals:manage')
    .input(z.enum(['PENDING_REFUND', 'REFUNDED']))
    .query(({ ctx, input }) => listWithdrawalRequests(ctx.db, input)),
  pendingCount: permissionProcedure('withdrawals:manage').query(({ ctx }) =>
    countPendingWithdrawals(ctx.db),
  ),
  markRefunded: permissionProcedure('withdrawals:manage')
    .input(z.uuid())
    .mutation(async ({ ctx, input }) => {
      const number = await markWithdrawalRefunded(
        ctx.db,
        input,
        ctx.session.user.id,
      );
      if (!number) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'El arrepentimiento no existe o ya estaba reintegrado',
        });
      }
      logger.info('Withdrawal marked as refunded', {
        operation: 'withdrawal_refund',
        withdrawalId: input,
        number,
        userId: ctx.session.user.id,
      });
      return { number };
    }),
});
