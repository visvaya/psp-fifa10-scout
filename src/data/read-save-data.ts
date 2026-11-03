import { hexToBytes } from "@noble/ciphers/utils.js";
import { parseParamSfo, savedFileHash } from "./param-sfo.ts";
import { decryptSaveData } from "./psp-save-crypto.ts";
import { SaveFormatError } from "./save-format-error.ts";

/** The supported game release. */
export const FIFA10 = {
  titleId: "ULES01328",
  dataFileName: "DATA.BIN",
  /** Savedata key the game passes to the PSP firmware; a constant in its executable. */
  saveKey: hexToBytes("f0c7f22683e651c8cec54e343241504b"),
} as const;

/** First byte of SAVEDATA_PARAMS: 0 for a save PPSSPP wrote without encryption, 0x41 for mode 5. */
const CRYPT_FLAG_NONE = 0x00;
const CRYPT_FLAG_MODE5 = 0x41;

/**
 * The plain contents of a FIFA 10 DATA.BIN, from the file and its PARAM.SFO. Accepts both encrypted
 * saves (a real PSP, PPSSPP by default) and unencrypted ones (PPSSPP with EncryptSave off).
 */
export const readSaveData = (dataBin: Uint8Array, paramSfo: Uint8Array): Uint8Array => {
  const sfo = parseParamSfo(paramSfo);
  const params = sfo.get("SAVEDATA_PARAMS");
  const fileList = sfo.get("SAVEDATA_FILE_LIST");
  if (!(params instanceof Uint8Array) || !(fileList instanceof Uint8Array)) {
    throw new SaveFormatError("PARAM.SFO does not describe a save");
  }
  const flag = params[0];
  if (flag === CRYPT_FLAG_NONE) return dataBin;
  if (flag !== CRYPT_FLAG_MODE5) {
    throw new SaveFormatError(`Unsupported save encryption (flag 0x${(flag ?? 0).toString(16)})`);
  }
  const hash = savedFileHash(fileList, FIFA10.dataFileName);
  if (hash === undefined) throw new SaveFormatError("PARAM.SFO lists no DATA.BIN");
  return decryptSaveData(dataBin, FIFA10.saveKey, hash);
};
