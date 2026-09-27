export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (resource: string) => new AppError(404, 'NOT_FOUND', `${resource} no encontrado.`);
export const forbidden = (message = 'No tienes permiso para realizar esta acción.') => new AppError(403, 'FORBIDDEN', message);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);
export const unauthorized = (message = 'Autenticación requerida.') => new AppError(401, 'UNAUTHORIZED', message);
