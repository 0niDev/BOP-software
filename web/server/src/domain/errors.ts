/**
 * Application error hierarchy. Mirrors utils/exceptions.py: every failure
 * carries a stable machine-readable code and an HTTP status so the HTTP
 * layer can translate without guessing.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: string, status = 400, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, "NOT_FOUND", 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required.") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, "CONFIGURATION_ERROR", 500);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "DATABASE_ERROR", 500, details);
  }
}

export class InsufficientStockError extends AppError {
  constructor(message: string) {
    super(message, "INSUFFICIENT_STOCK", 409);
  }
}

export class UnbalancedJournalEntryError extends AppError {
  constructor(message: string) {
    super(message, "UNBALANCED_JOURNAL_ENTRY", 500);
  }
}
