import { readFile } from "node:fs/promises";
import wasmPath from "./sha3_wasm_bg.7b9ca65ddd.wasm";

export interface DeepSeekPowChallenge {
  algorithm: string;
  challenge: string;
  salt: string;
  difficulty: number | string;
  expire_at: number | string;
  signature: string;
  target_path: string;
}

interface DeepSeekWasmExports {
  memory: WebAssembly.Memory;
  wasm_solve: (
    retptr: number,
    challengePtr: number,
    challengeLength: number,
    prefixPtr: number,
    prefixLength: number,
    difficulty: number,
  ) => void;
  __wbindgen_add_to_stack_pointer: (delta: number) => number;
  __wbindgen_export_0: (length: number, alignment: number) => number;
}

const WASM_PATH = wasmPath;

const textEncoder = new TextEncoder();

export class DeepSeekPowSolver {
  private exports?: DeepSeekWasmExports;

  async solve(challenge: DeepSeekPowChallenge): Promise<string> {
    if (challenge.algorithm !== "DeepSeekHashV1") {
      throw new Error(`Unsupported DeepSeek PoW algorithm: ${challenge.algorithm}`);
    }

    const answer = await this.calculateHash(challenge);
    if (typeof answer !== "number" || Number.isNaN(answer)) {
      throw new Error("DeepSeek PoW solver returned an invalid answer.");
    }

    return encodeDeepSeekPowResponse(challenge, answer);
  }

  private async calculateHash(challenge: DeepSeekPowChallenge): Promise<number> {
    const exports = await this.getExports();
    const challengeBytes = textEncoder.encode(challenge.challenge);
    const prefixBytes = textEncoder.encode(`${challenge.salt}_${challenge.expire_at}_`);

    const challengePtr = exports.__wbindgen_export_0(challengeBytes.length, 1);
    const prefixPtr = exports.__wbindgen_export_0(prefixBytes.length, 1);
    const stackPtr = exports.__wbindgen_add_to_stack_pointer(-16);

    try {
      new Uint8Array(exports.memory.buffer).set(challengeBytes, challengePtr);
      new Uint8Array(exports.memory.buffer).set(prefixBytes, prefixPtr);

      exports.wasm_solve(
        stackPtr,
        challengePtr,
        challengeBytes.length,
        prefixPtr,
        prefixBytes.length,
        Number(challenge.difficulty),
      );

      const memory = new DataView(exports.memory.buffer);
      const status = memory.getInt32(stackPtr, true);
      if (status === 0) {
        throw new Error("DeepSeek PoW solver did not return a valid status.");
      }

      return Math.trunc(memory.getFloat64(stackPtr + 8, true));
    } finally {
      exports.__wbindgen_add_to_stack_pointer(16);
    }
  }

  private async getExports(): Promise<DeepSeekWasmExports> {
    if (this.exports) {
      return this.exports;
    }

    const wasmUrl = new URL(WASM_PATH, import.meta.url);
    const wasmBytes = await readFile(wasmUrl);
    const result = await WebAssembly.instantiate(wasmBytes, {});
    this.exports = result.instance.exports as unknown as DeepSeekWasmExports;
    return this.exports;
  }
}

export function encodeDeepSeekPowResponse(challenge: DeepSeekPowChallenge, answer: number): string {
  const payload = {
    algorithm: challenge.algorithm,
    challenge: challenge.challenge,
    salt: challenge.salt,
    answer,
    signature: challenge.signature,
    target_path: challenge.target_path,
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}
