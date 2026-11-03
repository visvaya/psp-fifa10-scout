/** A save file or its PARAM.SFO cannot be read: wrong format, unsupported mode or failed check. */
export class SaveFormatError extends Error {
  override readonly name = "SaveFormatError";
}
