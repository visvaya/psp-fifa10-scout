/** A user file (save, PARAM.SFO, game database) cannot be read: wrong format, unsupported mode or failed check. */
export class SaveFormatError extends Error {
  override readonly name = "SaveFormatError";
}
