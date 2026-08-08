/**
 * Structured Logger — replaces console.log/warn/error across the codebase.
 * Uses Pino for JSON structured logging in production, pretty-printed in dev.
 *
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info({ userId, email }, 'User logged in');
 *   logger.error({ err }, 'Login failed');
 */

let logger;

try {
  const pino = require('pino');
  logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
      : undefined,
    base: { service: 'skillnix-ats', version: 'v3' },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token', 'secret', 'mfaSecret'],
      censor: '[REDACTED]',
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
  });
} catch (e) {
  // Pino not installed — console fallback (also Jest-safe: no top-level return).
  const wrapConsole = (level) => (objOrMsg, ...args) => {
    if (typeof objOrMsg === 'string') {
      console[level](objOrMsg, ...args);
    } else {
      console[level](args[0] || '', objOrMsg);
    }
  };
  logger = {
    info: wrapConsole('log'),
    warn: wrapConsole('warn'),
    error: wrapConsole('error'),
    debug: wrapConsole('debug'),
    fatal: wrapConsole('error'),
    child: () => logger,
  };
}

module.exports = logger;
