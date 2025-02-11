/*
 * The code in this file originated from
 * @see https://github.com/decentralized-identity/sidetree
 * For the list of changes that was made to the original code
 * @see https://github.com/transmute-industries/sidetree.js/blob/main/reference-implementation-changes.md
 *
 * Copyright 2020 - Transmute Industries Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ITransactionStore, TransactionModel } from '@sidetree/common';
import { MongoClient } from 'mongodb';
import MongoDbTransactionStore from '../MongoDbTransactionStore';
import config from './config-test.json';

/**
 * Creates a MongoDbTransactionStore and initializes it.
 */
async function createTransactionStore(
  transactionStoreUri: string,
  databaseName: string
): Promise<MongoDbTransactionStore> {
  const transactionStore = new MongoDbTransactionStore(
    transactionStoreUri,
    databaseName
  );
  await transactionStore.initialize();
  return transactionStore;
}

/**
 * Generates transactions where all the properties are initialized to the 1-based index of the transaction.
 * e.g. First transaction will have all properties assigned as 1 or '1';
 * @param transactionStore The transaction store to store the generated transactions.
 * @param count Number of transactions to generate and store.
 */
async function generateAndStoreTransactions(
  transactionStore: ITransactionStore,
  count: number
): Promise<TransactionModel[]> {
  const transactions: TransactionModel[] = [];
  for (let i = 1; i <= count; i++) {
    const transaction: TransactionModel = {
      anchorString: i.toString(),
      transactionNumber: i,
      transactionTime: i,
      transactionHash: i.toString(),
      transactionTimeHash: i.toString(),
      transactionFeePaid: 1,
      normalizedTransactionFee: 1,
      writer: 'writer',
    };

    await transactionStore.addTransaction(transaction);

    transactions.push(transaction);
  }

  return transactions;
}

describe('MongoDbTransactionStore', () => {
  let transactionStore: MongoDbTransactionStore;
  const collectionName = 'transactions';
  beforeAll(async () => {
    transactionStore = await createTransactionStore(
      config.mongoDbConnectionString,
      config.databaseName
    );
  });

  beforeEach(async () => {
    try {
      await transactionStore.clearCollection();
    } catch (e) {
      //
    }
  });

  afterAll(async () => {
    await transactionStore.close();
  });

  it('should create collections needed on initialization if they do not exist.', async () => {
    console.info(`Deleting collections...`);
    const client = await MongoClient.connect(config.mongoDbConnectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const db = client.db(config.databaseName);
    await db.dropCollection(collectionName);

    console.info(`Verify collections no longer exist.`);
    let collections = await db.collections();
    let collectionNames = collections.map(
      (collection) => collection.collectionName
    );
    expect(collectionNames.includes(collectionName)).toBeFalsy();

    console.info(`Trigger initialization.`);
    await transactionStore.initialize();

    console.info(`Verify collection exists now.`);
    collections = await db.collections();
    collectionNames = collections.map(
      (collection) => collection.collectionName
    );
    expect(collectionNames.includes(collectionName)).toBeTruthy();
    await client.close();
  });

  it('should be able to fetch the count of transactions.', async () => {
    const transactionCount = 3;
    await generateAndStoreTransactions(transactionStore, transactionCount);

    const actualTransactionCount = await transactionStore.getTransactionsCount();
    expect(actualTransactionCount).toEqual(transactionCount);
  });

  it('should be able to fetch transaction by transaction number.', async () => {
    const transactionCount = 3;
    await generateAndStoreTransactions(transactionStore, transactionCount);

    const transaction = await transactionStore.getTransaction(2);
    expect(transaction!.transactionTime).toEqual(2);
  });

  it('should return undefined if unable to find transaction of the given transaction number.', async () => {
    const transactionCount = 3;
    await generateAndStoreTransactions(transactionStore, transactionCount);

    const transaction = await transactionStore.getTransaction(4);
    expect(transaction).toBeUndefined();
  });

  it('should be able to fetch transactions later than a given transaction number.', async () => {
    const transactionCount = 3;
    await generateAndStoreTransactions(transactionStore, transactionCount);

    const transactions = await transactionStore.getTransactionsLaterThan(
      1,
      100
    );
    expect(transactions.length).toEqual(2);
    expect(transactions[0].transactionNumber).toEqual(2);
    expect(transactions[1].transactionNumber).toEqual(3);
  });

  it('should fetch transactions from the start if transaction number is not given.', async () => {
    const transactionCount = 3;
    await generateAndStoreTransactions(transactionStore, transactionCount);

    const transactions = await transactionStore.getTransactionsLaterThan(
      undefined,
      undefined
    );
    expect(transactions.length).toEqual(3);
    expect(transactions[0].transactionNumber).toEqual(1);
    expect(transactions[1].transactionNumber).toEqual(2);
    expect(transactions[2].transactionNumber).toEqual(3);
  });

  it('should limit the transactions fetched if a limit is defined.', async () => {
    const transactionCount = 3;
    await generateAndStoreTransactions(transactionStore, transactionCount);

    const transactions = await transactionStore.getTransactionsLaterThan(
      undefined,
      2
    );
    expect(transactions.length).toEqual(2);
    expect(transactions[0].transactionNumber).toEqual(1);
    expect(transactions[1].transactionNumber).toEqual(2);
  });

  it('should not store duplicated transactions.', async () => {
    const transactionCount = 3;
    await generateAndStoreTransactions(transactionStore, transactionCount);

    let transactions = await transactionStore.getTransactions();
    expect(transactions.length).toEqual(transactionCount);

    // Attempt to reinsert the same transaction with the same property values.
    await generateAndStoreTransactions(transactionStore, transactionCount);

    transactions = await transactionStore.getTransactions();
    expect(transactions.length).toEqual(transactionCount);
  });

  it('should be able to get the last transaction.', async () => {
    const transactionCount = 10;
    await generateAndStoreTransactions(transactionStore, transactionCount);

    const lastTransaction = await transactionStore.getLastTransaction();

    expect(lastTransaction).toBeDefined();
    expect(lastTransaction!.transactionNumber).toEqual(transactionCount);
  });

  it('should return undefined if there are no transactions when getting the last transaction.', async () => {
    const lastTransaction = await transactionStore.getLastTransaction();

    expect(lastTransaction).toBeUndefined();
  });

  it('should be able to return exponentially spaced transactions.', async () => {
    const transactionCount = 8;
    await generateAndStoreTransactions(transactionStore, transactionCount);

    // Exponentially spaced transations in reverse chronological order.
    const exponentiallySpacedTransactions = await transactionStore.getExponentiallySpacedTransactions();
    expect(exponentiallySpacedTransactions.length).toEqual(4);
    expect(exponentiallySpacedTransactions[0].transactionNumber).toEqual(8);
    expect(exponentiallySpacedTransactions[1].transactionNumber).toEqual(7);
    expect(exponentiallySpacedTransactions[2].transactionNumber).toEqual(5);
    expect(exponentiallySpacedTransactions[3].transactionNumber).toEqual(1);
  });

  it('should be able to delete transactions greater than a given transaction time.', async () => {
    const transactionCount = 10;
    await generateAndStoreTransactions(transactionStore, transactionCount);

    // Deleting all transactions that are later than transaction number 5.
    await transactionStore.removeTransactionsLaterThan(5);

    // Expecting only transaction 1 & 2 are remaining transactions.
    const remainingTransactions = await transactionStore.getTransactions();
    expect(remainingTransactions.length).toEqual(5);
    const remainingTransactionNumbers = remainingTransactions.map(
      (transaction) => transaction.transactionNumber
    );
    expect(remainingTransactionNumbers.includes(1)).toBeTruthy();
    expect(remainingTransactionNumbers.includes(2)).toBeTruthy();
    expect(remainingTransactionNumbers.includes(3)).toBeTruthy();
    expect(remainingTransactionNumbers.includes(4)).toBeTruthy();
    expect(remainingTransactionNumbers.includes(5)).toBeTruthy();
  });

  it('should be able to delete all transactions.', async () => {
    const transactionCount = 10;
    await generateAndStoreTransactions(transactionStore, transactionCount);

    // Deleting all transactions by not passing any argument.
    await transactionStore.removeTransactionsLaterThan();

    const remainingTransactions = await transactionStore.getTransactions();
    expect(remainingTransactions.length).toEqual(0);
  });

  it('should default the database name as `sidetree` if not explicitly overriden.', async () => {
    const transactionStore = new MongoDbTransactionStore(
      config.mongoDbConnectionString,
      config.databaseName
    );
    expect(transactionStore.databaseName).toEqual(config.databaseName);
  });

  it('should fetch transactions by 1 transactionTime when end time is the same as begin time', async () => {
    const transaction1: TransactionModel = {
      anchorString: 'string1',
      transactionNumber: 1,
      transactionTime: 1,
      transactionHash: '1',
      transactionTimeHash: '1',
      transactionFeePaid: 1,
      normalizedTransactionFee: 1,
      writer: 'writer1',
    };

    const transaction2: TransactionModel = {
      anchorString: 'string2',
      transactionNumber: 2,
      transactionTime: 2,
      transactionHash: '2',
      transactionTimeHash: '2',
      transactionFeePaid: 1,
      normalizedTransactionFee: 1,
      writer: 'writer2',
    };

    const transaction3: TransactionModel = {
      anchorString: 'string3',
      transactionNumber: 3,
      transactionTime: 2,
      transactionHash: '2',
      transactionTimeHash: '2',
      transactionFeePaid: 1,
      normalizedTransactionFee: 1,
      writer: 'writer3',
    };

    await transactionStore.addTransaction(transaction1);
    await transactionStore.addTransaction(transaction2);
    await transactionStore.addTransaction(transaction3);

    const result = await transactionStore.getTransactionsStartingFrom(2, 2);
    expect(result.length).toEqual(2);
    expect(result[0].transactionNumber).toEqual(2);
    expect(result[1].transactionNumber).toEqual(3);
  });

  it('should fetch transactions going forward in time when end time is greater than begin time', async () => {
    const transaction1: TransactionModel = {
      anchorString: 'string1',
      transactionNumber: 1,
      transactionTime: 1,
      transactionHash: '1',
      transactionTimeHash: '1',
      transactionFeePaid: 1,
      normalizedTransactionFee: 1,
      writer: 'writer1',
    };

    const transaction2: TransactionModel = {
      anchorString: 'string2',
      transactionNumber: 2,
      transactionTime: 2,
      transactionHash: '2',
      transactionTimeHash: '2',
      transactionFeePaid: 1,
      normalizedTransactionFee: 1,
      writer: 'writer2',
    };

    const transaction3: TransactionModel = {
      anchorString: 'string3',
      transactionNumber: 3,
      transactionTime: 3,
      transactionHash: '3',
      transactionTimeHash: '3',
      transactionFeePaid: 1,
      normalizedTransactionFee: 1,
      writer: 'writer3',
    };

    await transactionStore.addTransaction(transaction1);
    await transactionStore.addTransaction(transaction2);
    await transactionStore.addTransaction(transaction3);

    const result = await transactionStore.getTransactionsStartingFrom(1, 3);
    expect(result.length).toEqual(2);
    expect(result[0].transactionNumber).toEqual(1);
    expect(result[1].transactionNumber).toEqual(2);
  });

  it('should fetch no transactions if begin is greater than end', async () => {
    const transaction1: TransactionModel = {
      anchorString: 'string1',
      transactionNumber: 1,
      transactionTime: 1,
      transactionHash: '1',
      transactionTimeHash: '1',
      transactionFeePaid: 1,
      normalizedTransactionFee: 1,
      writer: 'writer1',
    };

    const transaction2: TransactionModel = {
      anchorString: 'string2',
      transactionNumber: 2,
      transactionTime: 2,
      transactionHash: '2',
      transactionTimeHash: '2',
      transactionFeePaid: 1,
      normalizedTransactionFee: 1,
      writer: 'writer2',
    };

    const transaction3: TransactionModel = {
      anchorString: 'string3',
      transactionNumber: 3,
      transactionTime: 3,
      transactionHash: '3',
      transactionTimeHash: '3',
      transactionFeePaid: 1,
      normalizedTransactionFee: 1,
      writer: 'writer3',
    };

    await transactionStore.addTransaction(transaction1);
    await transactionStore.addTransaction(transaction2);
    await transactionStore.addTransaction(transaction3);

    const result = await transactionStore.getTransactionsStartingFrom(3, 1);
    expect(result.length).toEqual(0);
  });
});
