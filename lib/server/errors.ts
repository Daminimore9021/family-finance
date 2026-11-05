export class AppError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.fields = fields;
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) => new AppError(400, message, fields);
export const unauthorized = (message = "Please log in again") => new AppError(401, message);
export const notFound = (message = "Record not found") => new AppError(404, message);
export const conflict = (message: string, fields?: Record<string, string>) => new AppError(409, message, fields);
