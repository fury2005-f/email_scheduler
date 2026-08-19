import { PrismaClient } from '@prisma/client';

// Prevent JSON.stringify errors when serializing BigInt sequence numbers
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export const prisma = new PrismaClient();
