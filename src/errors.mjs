/** Fixed public error codes; never carry upstream diagnostics to the browser. */
export class ManagerError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
