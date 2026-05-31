import * as Joi from 'joi';

const isProd = Joi.string().valid('production');

export const envValidationSchema = Joi.object({
  SERVICE_NAME: Joi.string().default('Auth Service'),
  PORT: Joi.number().port().default(3001),
  APP_URL: Joi.string().optional().allow(''),
  APP_TIMEZONE: Joi.string().default('Asia/Ho_Chi_Minh'),
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),
  GLOBAL_PREFIX: Joi.string().default('api'),
  CORS_ORIGINS: Joi.alternatives().conditional('NODE_ENV', {
    is: isProd,
    then: Joi.string()
      .required()
      .pattern(/^(?!\*$).+/, { name: 'no-wildcard' })
      .messages({
        'string.pattern.name':
          'CORS_ORIGINS must be an explicit comma-separated origin list in production (no "*").',
      }),
    otherwise: Joi.string().default('*'),
  }),

  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.alternatives().conditional('NODE_ENV', {
    is: isProd,
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(''),
  }),

  JWT_PRIVATE_KEY_PEM: Joi.alternatives().conditional('NODE_ENV', {
    is: isProd,
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  JWT_PUBLIC_KEY_PEM: Joi.alternatives().conditional('NODE_ENV', {
    is: isProd,
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  JWT_ISSUER: Joi.string().default('auth-service'),
  JWT_AUDIENCE: Joi.string().default('comic-platform'),

  GOOGLE_CLIENT_ID: Joi.string().optional().allow(''),
  GOOGLE_CLIENT_SECRET: Joi.string().optional().allow(''),
  GOOGLE_CALLBACK_URL: Joi.string().optional().allow(''),
  // GOOGLE_FRONTEND_URL is interpolated into the OAuth callback redirect.
  // Tighten to https URI in prod so a misconfigured / tampered env can't
  // turn the callback into an open redirect that leaks the freshly-issued
  // auth cookie to attacker-controlled hosts.
  GOOGLE_FRONTEND_URL: Joi.alternatives().conditional('NODE_ENV', {
    is: isProd,
    then: Joi.string().uri({ scheme: ['https'] }).when('GOOGLE_CLIENT_ID', {
      is: Joi.string().min(1),
      then: Joi.required(),
      otherwise: Joi.optional().allow(''),
    }),
    otherwise: Joi.string().uri({ scheme: ['http', 'https'] }).optional().allow(''),
  }),
  GOOGLE_OAUTH_STATE_SECRET: Joi.alternatives().conditional('NODE_ENV', {
    is: isProd,
    then: Joi.string().min(32).when('GOOGLE_CLIENT_ID', {
      is: Joi.string().min(1),
      then: Joi.required(),
      otherwise: Joi.optional().allow(''),
    }),
    otherwise: Joi.string().optional().allow(''),
  }),

  INTERNAL_API_SECRET: Joi.alternatives().conditional('NODE_ENV', {
    is: isProd,
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().optional().allow(''),
  }),

  SECURITY_ATTEMPT_MAX: Joi.number().default(5),
  SECURITY_ATTEMPT_WINDOW_SECONDS: Joi.number().default(900),
  SECURITY_ATTEMPT_LOCKOUT_SECONDS: Joi.number().default(1800),
  OTP_TTL_SECONDS: Joi.number().default(300),
  BCRYPT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),

  EVENT_DRIVER: Joi.string().valid('local', 'kafka', 'rabbitmq', 'redis').default('local'),
  RABBITMQ_URL: Joi.alternatives().conditional('EVENT_DRIVER', {
    is: 'rabbitmq',
    then: Joi.string().uri().required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  KAFKA_BROKERS: Joi.string().optional().allow(''),
  KAFKA_GROUP_ID: Joi.string().optional().allow(''),
}).unknown(true);
