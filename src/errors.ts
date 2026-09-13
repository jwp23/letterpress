/** An error whose message is meant for the person running the CLI. */
export class LetterpressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LetterpressError';
  }
}
