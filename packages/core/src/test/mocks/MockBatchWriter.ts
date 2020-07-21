import { IBatchWriter } from '@sidetree/common';

/**
 * Mock Blockchain class for testing.
 */
export default class MockBatchWriter implements IBatchWriter {
  /** Keeps invocation count for testing purposes. */
  public invocationCount = 0;

  public async write(): Promise<void> {
    this.invocationCount++;
  }
}