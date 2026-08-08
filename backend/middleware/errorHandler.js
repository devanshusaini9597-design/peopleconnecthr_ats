/**
 * Centralized Express error-handling middleware.
 *
 * Catches all errors thrown or passed via next(err) in route handlers.
 * Returns a consistent JSON error response and logs the error.
 *
 * Usage: app.use(errorHandler);  // Mount AFTER all routes
 */

const errorHandler = (err, req, res, next) => {
  // If headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Log the error (structured if logger available)
  let logger;
  try {
    logger = require('../utils/logger');
  } catch (e) {
    logger = console;
  }

  if (statusCode >= 500) {
    logger.error({
      err: {
        message: err.message,
        stack: err.stack,
        code: err.code,
      },
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.id,
      organizationId: req.user?.organizationId,
    }, `[${statusCode}] ${err.message}`);
  } else {
    logger.warn({
      statusCode,
      message: err.message,
      method: req.method,
      url: req.originalUrl,
    }, `[${statusCode}] ${err.message}`);
  }

  res.status(statusCode).json({
    success: false,
    message: isProduction && statusCode >= 500
      ? 'Internal server error'
      : err.message || 'Something went wrong',
    ...(err.code && { code: err.code }),
    ...(!isProduction && { stack: err.stack }),
  });
};

/**
 * Custom application error class with status code support.
 * Usage: throw new AppError('Not found', 404);
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { errorHandler, AppError };
