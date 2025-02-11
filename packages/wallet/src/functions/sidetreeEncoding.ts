/*
 * Copyright 2020 - Transmute Industries Inc.
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

import crypto from 'crypto';
import { Multihash, Encoder } from '@sidetree/common';

const sha256AlgorithmMultihashCode = 18;

export const sha256 = (data: Buffer): Buffer => {
  return crypto
    .createHash('sha256') // may need to change in the future.
    .update(data)
    .digest();
};

export const hashThenEncode = (data: Buffer): string => {
  return Multihash.hashThenEncode(data, sha256AlgorithmMultihashCode);
};

export const canonicalizeThenHashThenEncode = (data: object): string => {
  return Multihash.canonicalizeThenHashThenEncode(data);
};

export const canonicalizeThenDoubleHashThenEncode = (data: object): string => {
  return Multihash.canonicalizeThenDoubleHashThenEncode(data);
};

export const encode = (data: Buffer | string): string => {
  return Encoder.encode(data);
};
