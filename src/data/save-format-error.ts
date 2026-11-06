/** What a user file turned out to be: another game's, another kind of file, a non-career save or damaged. */
export type SaveFormatErrorKind = "wrong-game" | "wrong-file" | "not-career" | "damaged";

/** A user file (save, PARAM.SFO, game database) cannot be read: wrong format, unsupported mode or failed check. */
export class SaveFormatError extends Error {
  override readonly name = "SaveFormatError";
  readonly kind: SaveFormatErrorKind;

  constructor(message: string, kind: SaveFormatErrorKind = "damaged") {
    super(message);
    this.kind = kind;
  }
}
