import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodError } from 'zod';
import { AppError } from '@shared/errors/app-error';

function buildValidationError(err: ZodError): AppError {
  return new AppError(400, 'VALIDATION_ERROR', 'Validation failed', err.flatten().fieldErrors);
}

/**
 * Validates req.body against the given Zod schema.
 * Usage: router.post('/', validate(MySchema), handler)
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw buildValidationError(result.error);
    }
    req.body = result.data as unknown;
    next();
  };
}

/**
 * Validates req.query against the given Zod schema.
 * Usage: router.get('/', validateQuery(MyQuerySchema), handler)
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      throw buildValidationError(result.error);
    }
    req.query = result.data as qs.ParsedQs;
    next();
  };
}

/**
 * Validates req.params against the given Zod schema.
 * Usage: router.get('/:id', validateParams(MyParamSchema), handler)
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      throw buildValidationError(result.error);
    }
    req.params = result.data as Record<string, string>;
    next();
  };
}
