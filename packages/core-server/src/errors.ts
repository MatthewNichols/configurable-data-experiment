import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { flattenIssues, type FieldErrors } from '@cde/sdk';
import { ValidationError } from '@cde/sdk/server';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
  }
}

/** Maps Prisma known-request errors onto HTTP errors. */
export function fromPrismaError(err: unknown): HttpError | undefined {
  const e = err as { code?: string; meta?: Record<string, any> };
  if (e?.code === 'P2002') {
    const fields: string[] =
      e.meta?.target ?? e.meta?.driverAdapterError?.cause?.constraint?.fields ?? [];
    const fieldErrors = Object.fromEntries(fields.map((f) => [String(f).replace(/"/g, ''), 'Already exists']));
    return new HttpError(409, 'A record with the same unique value already exists', fieldErrors);
  }
  if (e?.code === 'P2003') return new HttpError(422, 'Referenced record does not exist');
  if (e?.code === 'P2025') return new HttpError(404, 'Not found');
  return undefined;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(422).json({ error: 'Validation failed', fieldErrors: flattenIssues(err) });
    return;
  }
  if (err instanceof ValidationError) {
    res.status(422).json({ error: err.message, fieldErrors: err.fieldErrors });
    return;
  }
  const http = err instanceof HttpError ? err : fromPrismaError(err);
  if (http) {
    res.status(http.status).json({ error: http.message, fieldErrors: http.fieldErrors });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
