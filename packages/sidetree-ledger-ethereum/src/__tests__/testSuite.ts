import { IBlockchain } from '@sidetree/common';
import { anchorString, anchorString2, anchorString3 } from '../__fixtures__';

jest.setTimeout(10 * 1000);

const testSuite = (ledger: IBlockchain): void => {
  describe(ledger.constructor.name, () => {
    describe('write', () => {
      it('should write to the ledger', async () => {
        await ledger.write(anchorString);
      });
    });

    describe('getApproximateTime', () => {
      it('should get latest cached blockchain time', async () => {
        // cachedTime should initially not be defined
        let cachedTime = await ledger.approximateTime;
        expect(cachedTime.time).toBe(0);
        expect(cachedTime.hash).toBe('');
        const realTime = await (ledger as any).getLatestTime();
        cachedTime = await ledger.approximateTime;
        expect(cachedTime.time).toBe(realTime.time);
        expect(cachedTime.hash).toBe(realTime.hash);
      });
    });

    describe('read', () => {
      let transactionTimeHash: string;
      let sinceTransactionNumber: number;

      it('should get all transactions', async () => {
        const readResult = await ledger.read();
        expect(readResult.moreTransactions).toBeFalsy();
        expect(readResult.transactions).toHaveLength(1);
        expect(readResult.transactions[0].transactionNumber).toBe(0);
        expect(readResult.transactions[0].transactionTime).toBeDefined();
        expect(readResult.transactions[0].transactionTimeHash).toBeDefined();
        expect(readResult.transactions[0].anchorString).toBe(anchorString);
        expect(readResult.transactions[0].writer).toBeDefined();

        await ledger.write(anchorString2);
        const readResult2 = await ledger.read();
        expect(readResult2.moreTransactions).toBeFalsy();
        expect(readResult2.transactions).toHaveLength(2);
        expect(readResult2.transactions[0].anchorString).toBe(anchorString);
        expect(readResult2.transactions[1].anchorString).toBe(anchorString2);
        transactionTimeHash = readResult2.transactions[1].transactionTimeHash;
        sinceTransactionNumber = readResult2.transactions[1].transactionNumber;
      });

      it('should get a specific transaction', async () => {
        const readResult = await ledger.read(undefined, transactionTimeHash);
        expect(readResult.moreTransactions).toBeFalsy();
        expect(readResult.transactions).toHaveLength(1);
        expect(readResult.transactions[0].transactionTimeHash).toBe(
          transactionTimeHash
        );
        expect(readResult.transactions[0].anchorString).toBe(anchorString2);
      });

      it('should get all transactions since a block', async () => {
        await ledger.write(anchorString3);
        const readResult = await ledger.read(sinceTransactionNumber);
        expect(readResult.moreTransactions).toBeFalsy();
        expect(readResult.transactions).toHaveLength(2);
        expect(readResult.transactions[0].transactionNumber).toBe(
          sinceTransactionNumber
        );
        expect(readResult.transactions[1].transactionNumber).toBe(
          sinceTransactionNumber + 1
        );
        expect(readResult.transactions[0].anchorString).toBe(anchorString2);
        expect(readResult.transactions[1].anchorString).toBe(anchorString3);
      });
    });
  });
};

// eslint-disable-next-line jest/no-export
export default testSuite;