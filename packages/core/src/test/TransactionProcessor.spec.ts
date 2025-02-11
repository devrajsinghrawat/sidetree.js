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

/* eslint-disable jest/no-jasmine-globals */
import {
  AnchoredDataSerializer,
  ErrorCode,
  FetchResultCode,
  IBlockchain,
  SidetreeError,
  TransactionModel,
  FetchResult,
  ValueTimeLockModel,
} from '@sidetree/common';
import AnchorFile from '../write/AnchorFile';
import { MockCas } from '@sidetree/cas';
import ChunkFile from '../write/ChunkFile';
import Compressor from '../util/Compressor';
import DownloadManager from '../DownloadManager';
import JasmineSidetreeErrorValidator from './JasmineSidetreeErrorValidator';
import MapFile from '../write/MapFile';
import { MockLedger } from '@sidetree/ledger';
import MockOperationStore from './mocks/MockOperationStore';
import OperationGenerator from './generators/OperationGenerator';
import TransactionProcessor from '../TransactionProcessor';
import ValueTimeLockVerifier from '../ValueTimeLockVerifier';
import config from './config-test.json';

jest.setTimeout(10 * 1000);

console.info = (): null => null;

describe('TransactionProcessor', () => {
  let casClient: MockCas;
  let operationStore: MockOperationStore;
  let downloadManager: DownloadManager;
  let blockchain: IBlockchain;
  let transactionProcessor: TransactionProcessor;
  let versionMetadataFetcher: any = {};
  const versionMetadata = {
    normalizedFeeToPerOperationFeeMultiplier: 0.01,
  };
  versionMetadataFetcher = {
    getVersionMetadata: () => {
      return versionMetadata;
    },
  };

  beforeEach(() => {
    casClient = new MockCas();
    operationStore = new MockOperationStore();
    downloadManager = new DownloadManager(
      config.maxConcurrentDownloads,
      casClient
    );
    downloadManager.start();
    blockchain = new MockLedger();
    transactionProcessor = new TransactionProcessor(
      downloadManager,
      operationStore,
      blockchain,
      versionMetadataFetcher
    );
  });

  afterEach(async () => {
    downloadManager.stop();
  });

  describe('prcoessTransaction', () => {
    it('should ignore error and return true when AnchoredDataSerializer throws a sidetree error', async () => {
      const anchoredData = 'Bad Format';
      const mockTransaction: TransactionModel = {
        transactionNumber: 1,
        transactionTime: 1000000,
        transactionHash: 'hash',
        transactionTimeHash: '1000',
        anchorString: anchoredData,
        transactionFeePaid: 1,
        normalizedTransactionFee: 1,
        writer: 'writer',
      };
      const result = await transactionProcessor.processTransaction(
        mockTransaction
      );
      expect(result).toBeTruthy();
    });

    it('should ignore error and return true when FeeManager throws a sidetree error', async () => {
      const anchoredData = AnchoredDataSerializer.serialize({
        anchorFileHash: '1stTransaction',
        numberOfOperations: 0,
      });
      const mockTransaction: TransactionModel = {
        transactionNumber: 1,
        transactionTime: 1000000,
        transactionHash: 'hash',
        transactionTimeHash: '1000',
        anchorString: anchoredData,
        transactionFeePaid: 1,
        normalizedTransactionFee: 1,
        writer: 'writer',
      };
      const result = await transactionProcessor.processTransaction(
        mockTransaction
      );
      expect(result).toBeTruthy();
    });

    it('should return true if anchor file hash is not valid', async () => {
      spyOn(downloadManager, 'download').and.callFake(
        (): Promise<FetchResult> => {
          const result: FetchResult = { code: FetchResultCode.InvalidHash };
          return new Promise((resolve) => {
            resolve(result);
          });
        }
      );
      const anchoredData = AnchoredDataSerializer.serialize({
        anchorFileHash: '1stTransaction',
        numberOfOperations: 1,
      });
      const mockTransaction: TransactionModel = {
        transactionNumber: 1,
        transactionTime: 1000000,
        transactionHash: 'hash',
        transactionTimeHash: '1000',
        anchorString: anchoredData,
        transactionFeePaid: 999999,
        normalizedTransactionFee: 1,
        writer: 'writer',
      };
      const result = await transactionProcessor.processTransaction(
        mockTransaction
      );
      expect(result).toBeTruthy();
    });

    it('should return true if fetch result code is max size exceeded', async () => {
      spyOn(downloadManager, 'download').and.callFake(
        (): Promise<FetchResult> => {
          const result: FetchResult = { code: FetchResultCode.MaxSizeExceeded };
          return new Promise((resolve) => {
            resolve(result);
          });
        }
      );
      const anchoredData = AnchoredDataSerializer.serialize({
        anchorFileHash: '1stTransaction',
        numberOfOperations: 1,
      });
      const mockTransaction: TransactionModel = {
        transactionNumber: 1,
        transactionTime: 1000000,
        transactionHash: 'hash',
        transactionTimeHash: '1000',
        anchorString: anchoredData,
        transactionFeePaid: 999999,
        normalizedTransactionFee: 1,
        writer: 'writer',
      };
      const result = await transactionProcessor.processTransaction(
        mockTransaction
      );
      expect(result).toBeTruthy();
    });

    it('should return true if fetch result code is not a file', async () => {
      spyOn(downloadManager, 'download').and.callFake(
        (): Promise<FetchResult> => {
          const result: FetchResult = { code: FetchResultCode.NotAFile };
          return new Promise((resolve) => {
            resolve(result);
          });
        }
      );
      const anchoredData = AnchoredDataSerializer.serialize({
        anchorFileHash: '1stTransaction',
        numberOfOperations: 1,
      });
      const mockTransaction: TransactionModel = {
        transactionNumber: 1,
        transactionTime: 1000000,
        transactionHash: 'hash',
        transactionTimeHash: '1000',
        anchorString: anchoredData,
        transactionFeePaid: 999999,
        normalizedTransactionFee: 1,
        writer: 'writer',
      };
      const result = await transactionProcessor.processTransaction(
        mockTransaction
      );
      expect(result).toBeTruthy();
    });

    it('should return true if fetch result code is cas not reachable', async () => {
      spyOn(downloadManager, 'download').and.callFake(
        (): Promise<FetchResult> => {
          const result: FetchResult = { code: FetchResultCode.CasNotReachable };
          return new Promise((resolve) => {
            resolve(result);
          });
        }
      );
      const anchoredData = AnchoredDataSerializer.serialize({
        anchorFileHash: '1stTransaction',
        numberOfOperations: 1,
      });
      const mockTransaction: TransactionModel = {
        transactionNumber: 1,
        transactionTime: 1000000,
        transactionHash: 'hash',
        transactionTimeHash: '1000',
        anchorString: anchoredData,
        transactionFeePaid: 999999,
        normalizedTransactionFee: 1,
        writer: 'writer',
      };
      const result = await transactionProcessor.processTransaction(
        mockTransaction
      );
      expect(result).toBeFalsy();
    });

    it('should return true if fetch result code is not found', async () => {
      spyOn(downloadManager, 'download').and.callFake(
        (): Promise<FetchResult> => {
          const result: FetchResult = { code: FetchResultCode.NotFound };
          return new Promise((resolve) => {
            resolve(result);
          });
        }
      );
      const anchoredData = AnchoredDataSerializer.serialize({
        anchorFileHash: '1stTransaction',
        numberOfOperations: 1,
      });
      const mockTransaction: TransactionModel = {
        transactionNumber: 1,
        transactionTime: 1000000,
        transactionHash: 'hash',
        transactionTimeHash: '1000',
        anchorString: anchoredData,
        transactionFeePaid: 999999,
        normalizedTransactionFee: 1,
        writer: 'writer',
      };
      const result = await transactionProcessor.processTransaction(
        mockTransaction
      );
      expect(result).toBeFalsy();
    });

    it('should return false to allow retry if unexpected error is thrown', async () => {
      const anchoredData = AnchoredDataSerializer.serialize({
        anchorFileHash: '1stTransaction',
        numberOfOperations: 1,
      });
      const mockTransaction: TransactionModel = {
        transactionNumber: 1,
        transactionTime: 1000000,
        transactionHash: 'hash',
        transactionTimeHash: '1000',
        anchorString: anchoredData,
        transactionFeePaid: 999999,
        normalizedTransactionFee: 1,
        writer: 'writer',
      };

      // Mock a method used by `processTransaction` to throw an error.
      spyOn(AnchoredDataSerializer, 'deserialize').and.throwError(
        'Some unexpected error.'
      );

      const result = await transactionProcessor.processTransaction(
        mockTransaction
      );
      expect(result).toBeFalsy();
    });
  });

  describe('downloadAndVerifyAnchorFile', () => {
    it('should throw if paid operation count exceeded the protocol limit.', async () => {
      const mockTransaction: TransactionModel = {
        anchorString: 'anchor string',
        normalizedTransactionFee: 123,
        transactionFeePaid: 1234,
        transactionNumber: 98765,
        transactionTime: 5678,
        transactionHash: 'hash',
        transactionTimeHash: 'transaction time hash',
        writer: 'writer',
      };

      await JasmineSidetreeErrorValidator.expectSidetreeErrorToBeThrownAsync(
        () =>
          transactionProcessor['downloadAndVerifyAnchorFile'](
            mockTransaction,
            'mock_hash',
            999999
          ), // Some really large paid operation count.
        ErrorCode.TransactionProcessorPaidOperationCountExceedsLimit
      );
    });

    it('should throw if operation count in anchor file exceeded the paid limit.', async () => {
      const createOperation1 = (
        await OperationGenerator.generateCreateOperation()
      ).createOperation;
      const createOperation2 = (
        await OperationGenerator.generateCreateOperation()
      ).createOperation;
      const anyHash = OperationGenerator.generateRandomHash();
      const mockAnchorFileModel = await AnchorFile.createModel(
        'writerLockId',
        anyHash,
        [createOperation1, createOperation2],
        [],
        []
      );
      const mockAnchorFileBuffer = await Compressor.compress(
        Buffer.from(JSON.stringify(mockAnchorFileModel))
      );

      spyOn(transactionProcessor as any, 'downloadFileFromCas').and.returnValue(
        Promise.resolve(mockAnchorFileBuffer)
      );

      const mockTransaction: TransactionModel = {
        anchorString: 'anchor string',
        normalizedTransactionFee: 123,
        transactionFeePaid: 1234,
        transactionNumber: 98765,
        transactionTime: 5678,
        transactionHash: 'hash',
        transactionTimeHash: 'transaction time hash',
        writer: 'writer',
      };

      await JasmineSidetreeErrorValidator.expectSidetreeErrorToBeThrownAsync(
        () =>
          transactionProcessor['downloadAndVerifyAnchorFile'](
            mockTransaction,
            'mock_hash',
            1
          ),
        ErrorCode.AnchorFileOperationCountExceededPaidLimit
      );
    });

    it('should bubble up any errors thrown by verify lock routine', async () => {
      spyOn(transactionProcessor as any, 'downloadFileFromCas').and.returnValue(
        Promise.resolve(Buffer.from('value'))
      );

      const mockAnchorFile: AnchorFile = {
        createOperations: [],
        didUniqueSuffixes: ['abc', 'def'],
        model: {
          writer_lock_id: 'lock',
          map_file_uri: 'map_hash',
          operations: {},
        },
        recoverOperations: [],
        deactivateOperations: [],
      };
      spyOn(AnchorFile, 'parse').and.returnValue(
        Promise.resolve(mockAnchorFile)
      );

      const mockValueTimeLock: ValueTimeLockModel = {
        amountLocked: 1234,
        identifier: 'identifier',
        lockTransactionTime: 1234,
        unlockTransactionTime: 7890,
        normalizedFee: 200,
        owner: 'owner',
      };
      spyOn(
        transactionProcessor['blockchain'],
        'getValueTimeLock'
      ).and.returnValue(Promise.resolve(mockValueTimeLock));

      const mockTransaction: TransactionModel = {
        anchorString: 'anchor string',
        normalizedTransactionFee: 123,
        transactionFeePaid: 1234,
        transactionNumber: 98765,
        transactionTime: 5678,
        transactionHash: 'hash',
        transactionTimeHash: 'transaction time hash',
        writer: 'writer',
      };

      const mockErrorCode = 'some error code';
      const lockVerifySpy = spyOn(
        ValueTimeLockVerifier,
        'verifyLockAmountAndThrowOnError'
      ).and.callFake(() => {
        throw new SidetreeError(mockErrorCode);
      });

      const paidOperationCount = 52;
      await JasmineSidetreeErrorValidator.expectSidetreeErrorToBeThrownAsync(
        () =>
          transactionProcessor['downloadAndVerifyAnchorFile'](
            mockTransaction,
            'anchor_hash',
            paidOperationCount
          ),
        mockErrorCode
      );

      expect(lockVerifySpy).toHaveBeenCalledWith(
        mockValueTimeLock,
        paidOperationCount,
        mockTransaction.transactionTime,
        mockTransaction.writer,
        versionMetadataFetcher
      );
    });

    it('should return the parsed file.', async () => {
      const createOperationData = await OperationGenerator.generateCreateOperation();
      const anyHash = OperationGenerator.generateRandomHash();
      const mockAnchorFileModel = await AnchorFile.createModel(
        'wrierLockId',
        anyHash,
        [createOperationData.createOperation],
        [],
        []
      );
      const mockAnchorFileBuffer = await Compressor.compress(
        Buffer.from(JSON.stringify(mockAnchorFileModel))
      );

      spyOn(transactionProcessor as any, 'downloadFileFromCas').and.returnValue(
        Promise.resolve(mockAnchorFileBuffer)
      );
      spyOn(
        transactionProcessor['blockchain'],
        'getValueTimeLock'
      ).and.returnValue(Promise.resolve(undefined));
      spyOn(
        ValueTimeLockVerifier,
        'verifyLockAmountAndThrowOnError'
      ).and.returnValue(undefined);

      const mockTransaction: TransactionModel = {
        anchorString: 'anchor string',
        normalizedTransactionFee: 123,
        transactionFeePaid: 1234,
        transactionNumber: 98765,
        transactionTime: 5678,
        transactionHash: 'hash',
        transactionTimeHash: 'transaction time hash',
        writer: 'writer',
      };

      const paidBatchSize = 2;
      const downloadedAnchorFile = await transactionProcessor[
        'downloadAndVerifyAnchorFile'
      ](mockTransaction, 'mock_hash', paidBatchSize);
      expect(downloadedAnchorFile.model).toEqual(mockAnchorFileModel);
    });
  });

  describe('downloadAndVerifyMapFile', () => {
    it('should validate the map file when the map file does not declare the `operations` property.', async () => {
      const createOperationData = await OperationGenerator.generateCreateOperation();
      const mapFileHash = OperationGenerator.generateRandomHash();
      const anchorFileBuffer = await AnchorFile.createBuffer(
        'writerLockId',
        mapFileHash,
        [createOperationData.createOperation],
        [],
        []
      );
      const anchorFile = await AnchorFile.parse(anchorFileBuffer);

      // Setting up a mock map file that has 1 update in it to be downloaded.
      const chunkFileHash = OperationGenerator.generateRandomHash();
      const mockMapFileBuffer = await MapFile.createBuffer(chunkFileHash, []);
      spyOn(transactionProcessor as any, 'downloadFileFromCas').and.returnValue(
        Promise.resolve(mockMapFileBuffer)
      );

      // Setting the total paid operation count to be 1 (needs to be at least 2 in success case).
      const totalPaidOperationCount = 1;
      const fetchedMapFile = await transactionProcessor[
        'downloadAndVerifyMapFile'
      ](anchorFile, totalPaidOperationCount);

      expect(fetchedMapFile).toBeDefined();
      expect(fetchedMapFile!.updateOperations.length).toEqual(0);
      expect(fetchedMapFile!.model.chunks[0].chunk_file_uri).toEqual(
        chunkFileHash
      );
    });

    it('should return undefined if update operation count is greater than the max paid update operation count.', async () => {
      const createOperationData = await OperationGenerator.generateCreateOperation();
      const mapFileHash = OperationGenerator.generateRandomHash();
      const anchorFileBuffer = await AnchorFile.createBuffer(
        'writerLockId',
        mapFileHash,
        [createOperationData.createOperation],
        [],
        []
      );
      const anchorFile = await AnchorFile.parse(anchorFileBuffer);

      // Setting up a mock map file that has 1 update in it to be downloaded.
      const updateOperationRequestData = await OperationGenerator.generateUpdateOperationRequest();
      const chunkFileHash = OperationGenerator.generateRandomHash();
      const mockMapFileBuffer = await MapFile.createBuffer(chunkFileHash, [
        updateOperationRequestData.updateOperation,
      ]);
      spyOn(transactionProcessor as any, 'downloadFileFromCas').and.returnValue(
        Promise.resolve(mockMapFileBuffer)
      );

      // Setting the total paid operation count to be 1 (needs to be at least 2 in success case).
      const totalPaidOperationCount = 1;
      const fetchedMapFile = await transactionProcessor[
        'downloadAndVerifyMapFile'
      ](anchorFile, totalPaidOperationCount);

      expect(fetchedMapFile).toBeUndefined();
    });

    it('should return undefined if there are multiple operations for the same DID between anchor and map file.', async () => {
      const createOperationData = await OperationGenerator.generateCreateOperation();
      const mapFileHash = OperationGenerator.generateRandomHash();
      const anchorFileBuffer = await AnchorFile.createBuffer(
        'writerLockId',
        mapFileHash,
        [createOperationData.createOperation],
        [],
        []
      );
      const anchorFile = await AnchorFile.parse(anchorFileBuffer);

      // Setting up a mock map file that has 1 update in it to be downloaded.
      const updateOperationRequestData = await OperationGenerator.generateUpdateOperationRequest(
        createOperationData.createOperation.didUniqueSuffix
      );
      const chunkFileHash = OperationGenerator.generateRandomHash();
      const mockMapFileBuffer = await MapFile.createBuffer(chunkFileHash, [
        updateOperationRequestData.updateOperation,
      ]);
      spyOn(transactionProcessor as any, 'downloadFileFromCas').and.returnValue(
        Promise.resolve(mockMapFileBuffer)
      );

      const totalPaidOperationCount = 10;
      const fetchedMapFile = await transactionProcessor[
        'downloadAndVerifyMapFile'
      ](anchorFile, totalPaidOperationCount);

      expect(fetchedMapFile).toBeUndefined();
    });

    it('should return undefined if unexpected error caught.', async () => {
      const createOperationData = await OperationGenerator.generateCreateOperation();
      const mapFileHash = OperationGenerator.generateRandomHash();
      const anchorFileBuffer = await AnchorFile.createBuffer(
        'writerLockId',
        mapFileHash,
        [createOperationData.createOperation],
        [],
        []
      );
      const anchorFile = await AnchorFile.parse(anchorFileBuffer);

      // Mocking an unexpected error thrown.
      spyOn(transactionProcessor as any, 'downloadFileFromCas').and.throwError(
        'Any unexpected error.'
      );

      const totalPaidOperationCount = 10;
      const fetchedMapFile = await transactionProcessor[
        'downloadAndVerifyMapFile'
      ](anchorFile, totalPaidOperationCount);

      expect(fetchedMapFile).toBeUndefined();
    });

    it('should throw if a network related error is caught.', async () => {
      const createOperationData = await OperationGenerator.generateCreateOperation();
      const mapFileHash = OperationGenerator.generateRandomHash();
      const anchorFileBuffer = await AnchorFile.createBuffer(
        'writerLockId',
        mapFileHash,
        [createOperationData.createOperation],
        [],
        []
      );
      const anchorFile = await AnchorFile.parse(anchorFileBuffer);

      // Mocking a non-network related known error thrown.
      spyOn(transactionProcessor as any, 'downloadFileFromCas').and.callFake(
        () => {
          throw new SidetreeError(ErrorCode.CasNotReachable);
        }
      );

      const totalPaidOperationCount = 10;
      await JasmineSidetreeErrorValidator.expectSidetreeErrorToBeThrownAsync(
        () =>
          transactionProcessor['downloadAndVerifyMapFile'](
            anchorFile,
            totalPaidOperationCount
          ),
        ErrorCode.CasNotReachable
      );
    });

    it('should return undefined if non-network related known error is caught.', async () => {
      const createOperationData = await OperationGenerator.generateCreateOperation();
      const mapFileHash = OperationGenerator.generateRandomHash();
      const anchorFileBuffer = await AnchorFile.createBuffer(
        'writerLockId',
        mapFileHash,
        [createOperationData.createOperation],
        [],
        []
      );
      const anchorFile = await AnchorFile.parse(anchorFileBuffer);

      // Mocking a non-network related known error thrown.
      spyOn(transactionProcessor as any, 'downloadFileFromCas').and.callFake(
        () => {
          throw new SidetreeError(ErrorCode.CasFileTooLarge);
        }
      );

      const totalPaidOperationCount = 10;
      const fetchedMapFile = await transactionProcessor[
        'downloadAndVerifyMapFile'
      ](anchorFile, totalPaidOperationCount);

      expect(fetchedMapFile).toBeUndefined();
    });
  });

  describe('downloadAndVerifyChunkFile', () => {
    it('should return undefined if no map file is given.', async () => {
      const mapFileModel = undefined;
      const fetchedChunkFileModel = await transactionProcessor[
        'downloadAndVerifyChunkFile'
      ](mapFileModel);

      expect(fetchedChunkFileModel).toBeUndefined();
    });

    it('should return undefined if unexpected error caught.', async () => {
      const anyHash = OperationGenerator.generateRandomHash();
      const mapFileBuffer = await MapFile.createBuffer(anyHash, []);
      const mapFileModel = await MapFile.parse(mapFileBuffer);

      // Mocking an unexpected error thrown.
      spyOn(transactionProcessor as any, 'downloadFileFromCas').and.throwError(
        'Any unexpected error.'
      );

      const fetchedMapFile = await transactionProcessor[
        'downloadAndVerifyChunkFile'
      ](mapFileModel);

      expect(fetchedMapFile).toBeUndefined();
    });

    it('should throw if a network related error is caught.', async () => {
      const anyHash = OperationGenerator.generateRandomHash();
      const mapFileBuffer = await MapFile.createBuffer(anyHash, []);
      const mapFileModel = await MapFile.parse(mapFileBuffer);

      // Mocking a non-network related known error thrown.
      spyOn(transactionProcessor as any, 'downloadFileFromCas').and.callFake(
        () => {
          throw new SidetreeError(ErrorCode.CasNotReachable);
        }
      );

      await JasmineSidetreeErrorValidator.expectSidetreeErrorToBeThrownAsync(
        () => transactionProcessor['downloadAndVerifyChunkFile'](mapFileModel),
        ErrorCode.CasNotReachable
      );
    });

    it('should return undefined if non-network related known error is caught.', async () => {
      const anyHash = OperationGenerator.generateRandomHash();
      const mapFileBuffer = await MapFile.createBuffer(anyHash, []);
      const mapFileModel = await MapFile.parse(mapFileBuffer);

      // Mocking a non-network related known error thrown.
      spyOn(transactionProcessor as any, 'downloadFileFromCas').and.callFake(
        () => {
          throw new SidetreeError(ErrorCode.CasFileTooLarge);
        }
      );

      const fetchedMapFile = await transactionProcessor[
        'downloadAndVerifyChunkFile'
      ](mapFileModel);

      expect(fetchedMapFile).toBeUndefined();
    });
  });

  describe('composeAnchoredOperationModels', () => {
    it('should compose operations successfully given valid anchor, map, and chunk files.', async () => {
      // Create `TransactionModel`.
      const transactionModel: TransactionModel = {
        anchorString: 'anything',
        normalizedTransactionFee: 999,
        transactionFeePaid: 9999,
        transactionNumber: 1,
        transactionTime: 1,
        transactionHash: 'hash',
        transactionTimeHash: 'anyValue',
        writer: 'anyWriter',
      };

      // Create anchor file with 1 create operation.
      const createOperationData = await OperationGenerator.generateCreateOperation();
      const createOperation = createOperationData.createOperation;
      const mapFileHash = OperationGenerator.generateRandomHash();
      const anchorFileBuffer = await AnchorFile.createBuffer(
        'writerLockId',
        mapFileHash,
        [createOperation],
        [],
        []
      );
      const anchorFile = await AnchorFile.parse(anchorFileBuffer);

      // Create map file model with 1 update operation.
      const updateOperationRequestData = await OperationGenerator.generateUpdateOperationRequest();
      const updateOperation = updateOperationRequestData.updateOperation;
      const chunkFileHash = OperationGenerator.generateRandomHash();
      const mapFileBuffer = await MapFile.createBuffer(chunkFileHash, [
        updateOperation,
      ]);
      const mapFileModel = await MapFile.parse(mapFileBuffer);

      // Create chunk file model with delta for the 2 operations created above.
      const chunkFileBuffer = await ChunkFile.createBuffer(
        [createOperation],
        [],
        [updateOperation]
      );
      const chunkFileModel = await ChunkFile.parse(chunkFileBuffer);

      // Setting the total paid operation count to be 1 (needs to be at least 2 in success case).
      const anchoredOperationModels = await transactionProcessor[
        'composeAnchoredOperationModels'
      ](transactionModel, anchorFile, mapFileModel, chunkFileModel);

      expect(anchoredOperationModels.length).toEqual(2);
      expect(anchoredOperationModels[0].didUniqueSuffix).toEqual(
        createOperation.didUniqueSuffix
      );
      expect(anchoredOperationModels[0].operationIndex).toEqual(0);
      expect(anchoredOperationModels[0].transactionTime).toEqual(1);
      expect(anchoredOperationModels[1].didUniqueSuffix).toEqual(
        updateOperation.didUniqueSuffix
      );
    });

    it('should compose operations successfully given valid anchor file, but no map and chunk files.', async () => {
      // Create `TransactionModel`.
      const transactionModel: TransactionModel = {
        anchorString: 'anything',
        normalizedTransactionFee: 999,
        transactionFeePaid: 9999,
        transactionNumber: 1,
        transactionTime: 1,
        transactionHash: 'hash',
        transactionTimeHash: 'anyValue',
        writer: 'anyWriter',
      };

      // Create anchor file with 1 create operation.
      const createOperationData = await OperationGenerator.generateCreateOperation();
      const createOperation = createOperationData.createOperation;
      const mapFileHash = OperationGenerator.generateRandomHash();
      const anchorFileBuffer = await AnchorFile.createBuffer(
        'writerLockId',
        mapFileHash,
        [createOperation],
        [],
        []
      );
      const anchorFile = await AnchorFile.parse(anchorFileBuffer);

      // Setting the total paid operation count to be 1 (needs to be at least 2 in success case).
      const anchoredOperationModels = await transactionProcessor[
        'composeAnchoredOperationModels'
      ](transactionModel, anchorFile, undefined, undefined);

      expect(anchoredOperationModels.length).toEqual(1);
      expect(anchoredOperationModels[0].didUniqueSuffix).toEqual(
        createOperation.didUniqueSuffix
      );
      expect(anchoredOperationModels[0].operationIndex).toEqual(0);
      expect(anchoredOperationModels[0].transactionTime).toEqual(1);
    });
  });
});
