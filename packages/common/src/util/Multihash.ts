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

import * as crypto from 'crypto';
import Encoder from './Encoder';
import ErrorCode from '../errors/ErrorCode';
import JsonCanonicalizer from './JsonCanonicalizer';
import ProtocolParameters from './parameters';
import SidetreeError from '../errors/SidetreeError';

const multihashes = require('multihashes');

/**
 * Class that performs hashing operations using the multihash format.
 */
export default class Multihash {
  /**
   * Hashes the content using the hashing algorithm specified.
   * @param hashAlgorithmInMultihashCode The hashing algorithm to use. If not given, latest supported hashing algorithm will be used.
   */
  public static hash(
    content: Buffer,
    hashAlgorithmInMultihashCode?: number
  ): Buffer {
    if (hashAlgorithmInMultihashCode === undefined) {
      hashAlgorithmInMultihashCode =
        ProtocolParameters.hashAlgorithmInMultihashCode;
    }

    let hash;
    switch (hashAlgorithmInMultihashCode) {
      case 18: // SHA256
        hash = crypto
          .createHash('sha256') // SHA256
          .update(content)
          .digest();
        break;
      default:
        throw new SidetreeError(ErrorCode.MultihashUnsupportedHashAlgorithm);
    }

    const hashAlgorithmName = multihashes.codes[hashAlgorithmInMultihashCode];
    const multihash = multihashes.encode(hash, hashAlgorithmName);

    return multihash;
  }

  /**
   * Canonicalize the given content, then multihashes the result using the lastest supported hash algorithm, then encodes the multihash.
   * Mainly used for testing purposes.
   */
  public static canonicalizeThenHashThenEncode(content: object) {
    const contentBuffer = JsonCanonicalizer.canonicalizeAsBuffer(content);
    const multihashEncodedString = Multihash.hashThenEncode(
      contentBuffer,
      ProtocolParameters.hashAlgorithmInMultihashCode
    );
    return multihashEncodedString;
  }

  /**
   * Hashes the content using the hashing algorithm specified as a generic (non-multihash) hash.
   * @param hashAlgorithmInMultihashCode The hashing algorithm to use.
   * @returns A multihash buffer.
   */
  public static hashAsNonMultihashBuffer(
    content: Buffer,
    hashAlgorithmInMultihashCode: number
  ): Buffer {
    let hash;
    switch (hashAlgorithmInMultihashCode) {
      case 18: // SHA256
        hash = crypto
          .createHash('sha256')
          .update(content)
          .digest();
        break;
      case 22: // SHA3-256
        hash = crypto
          .createHash('sha3-256')
          .update(content)
          .digest();
        break;
      default:
        throw new SidetreeError(ErrorCode.MultihashUnsupportedHashAlgorithm);
    }

    return hash;
  }

  public static canonicalizeThenDoubleHashThenEncode(content: object) {
    const contentBuffer = JsonCanonicalizer.canonicalizeAsBuffer(content);

    // Double hash.
    const hashAlgorithmInMultihashCode = 18; // Default to SHA256.
    const intermediateHashBuffer = Multihash.hashAsNonMultihashBuffer(
      contentBuffer,
      hashAlgorithmInMultihashCode
    );
    const multihashEncodedString = Multihash.hashThenEncode(
      intermediateHashBuffer,
      hashAlgorithmInMultihashCode
    );
    return multihashEncodedString;
  }

  /**
   * Hashes the content using the hashing algorithm specified then codes the multihash buffer.
   * @param hashAlgorithmInMultihashCode The hashing algorithm to use.
   */
  public static hashThenEncode(
    content: Buffer,
    hashAlgorithmInMultihashCode: number
  ): string {
    const multihashBuffer = Multihash.hash(
      content,
      hashAlgorithmInMultihashCode
    );
    const multihashEncodedString = Encoder.encode(multihashBuffer);
    return multihashEncodedString;
  }

  /**
   * Given a multihash, returns the code of the hash algorithm used.
   * @throws `SidetreeError` if hash algorithm used for the given multihash is unsupported.
   */
  public static getHashAlgorithmCode(multihashBuffer: Buffer): number {
    const multihash = multihashes.decode(multihashBuffer);

    // Hash algorithm must be SHA-256.
    if (multihash.code !== 18) {
      throw new SidetreeError(ErrorCode.MultihashUnsupportedHashAlgorithm);
    }

    return multihash.code;
  }

  /**
   * Verifies that the given hash is a multihash computed using the latest supported hash algorithm known to this version of code.
   * @throws `SidetreeError` if the given hash is not a multihash computed using the latest supported hash algorithm.
   */
  public static verifyHashComputedUsingLatestSupportedAlgorithm(hash: Buffer) {
    const latestSupportedHashAlgorithmCode = 18;
    const isLatestSupportedHashFormat = Multihash.isComputedUsingHashAlgorithm(
      hash,
      latestSupportedHashAlgorithmCode
    ); // SHA-256.

    if (!isLatestSupportedHashFormat) {
      throw new SidetreeError(
        ErrorCode.MultihashNotLatestSupportedHashAlgorithm
      );
    }
  }

  /**
   * Checks if the given hash is a multihash with the expected hashing algorithm.
   */
  public static isComputedUsingHashAlgorithm(
    hash: Buffer,
    expectedHashAlgorithmInMultihashCode: number
  ): boolean {
    try {
      const multihash = multihashes.decode(hash);
      return multihash.code === expectedHashAlgorithmInMultihashCode;
    } catch {
      return false;
    }
  }

  /**
   * Verifies the given content against the given multihash.
   */
  public static isValidHash(
    encodedContent: string | undefined,
    encodedMultihash: string
  ): boolean {
    if (encodedContent === undefined) {
      return false;
    }

    try {
      const contentBuffer = Encoder.decodeAsBuffer(encodedContent);
      return Multihash.verify(contentBuffer, encodedMultihash);
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  /**
   * Canonicalizes the given content object, then verifies the multihash against the canonicalized string as a UTF8 buffer.
   */
  public static canonicalizeAndVerify(
    content: object | undefined,
    encodedMultihash: string
  ): boolean {
    if (content === undefined) {
      return false;
    }

    try {
      const contentBuffer = JsonCanonicalizer.canonicalizeAsBuffer(content);

      return Multihash.verify(contentBuffer, encodedMultihash);
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  /**
   * Verifies the multihash against the content `Buffer`.
   */
  private static verify(content: Buffer, encodedMultihash: string): boolean {
    try {
      const multihashBuffer = Encoder.decodeAsBuffer(encodedMultihash);

      const hashAlgorithmCode = Multihash.getHashAlgorithmCode(multihashBuffer);
      const actualHashBuffer = Multihash.hash(content, hashAlgorithmCode);

      if (Buffer.compare(actualHashBuffer, multihashBuffer) !== 0) {
        return false;
      }

      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
}
