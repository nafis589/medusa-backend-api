import { AppError } from '../app-error';

describe('AppError', () => {
  it('should construct an instance with status code, code, message and details', () => {
    const error = new AppError(400, 'BAD_REQUEST', 'Invalid input', { field: 'email' });
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('AppError');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('Invalid input');
    expect(error.details).toEqual({ field: 'email' });
  });

  it('should support convenience factories', () => {
    const badRequest = AppError.badRequest('validation error', { x: 1 });
    expect(badRequest.statusCode).toBe(400);
    expect(badRequest.code).toBe('VALIDATION_ERROR');
    expect(badRequest.message).toBe('validation error');
    expect(badRequest.details).toEqual({ x: 1 });

    const unauthorized = AppError.unauthorized('No access');
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.code).toBe('UNAUTHORIZED');

    const forbidden = AppError.forbidden();
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.code).toBe('FORBIDDEN');

    const notFound = AppError.notFound('Product');
    expect(notFound.statusCode).toBe(404);
    expect(notFound.code).toBe('NOT_FOUND');
    expect(notFound.message).toBe('Product not found');

    const conflict = AppError.conflict('Already exists');
    expect(conflict.statusCode).toBe(409);
    expect(conflict.code).toBe('CONFLICT');
  });
});
