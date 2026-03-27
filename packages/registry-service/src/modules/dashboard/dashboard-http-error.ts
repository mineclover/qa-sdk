export class DashboardHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: { error: string },
  ) {
    super(body.error);
  }
}
