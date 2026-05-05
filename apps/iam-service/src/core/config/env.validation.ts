import * as Joi from 'joi';

const isProd = Joi.string().valid('production');

export const envValidationSchema = Joi.object({
  SERVICE_NAME: Joi.string().default('IAM Service'),
  PORT: Joi.number().port().default(3008),
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

  AUTH_JWKS_URL: Joi.alternatives().conditional('NODE_ENV', {
    is: isProd,
    then: Joi.string().uri().required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  INTERNAL_API_SECRET: Joi.alternatives().conditional('NODE_ENV', {
    is: isProd,
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().optional().allow(''),
  }),

  RBAC_CACHE_TTL: Joi.number().default(86400),
  RBAC_CACHE_VERSION_TTL_MS: Joi.number().default(2000),
}).unknown(true);
