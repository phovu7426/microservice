import * as Joi from 'joi';

const isProd = Joi.string().valid('production');

export const envValidationSchema = Joi.object({
  SERVICE_NAME: Joi.string().default('Storage Service'),
  PORT: Joi.number().port().default(3003),
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

  STORAGE_TYPE: Joi.string().valid('local', 's3', 'cloudinary').default('local'),
  STORAGE_MAX_FILE_SIZE: Joi.number().integer().min(1024).max(524_288_000).default(10_485_760),
  STORAGE_LOCAL_PATH: Joi.string().optional().allow(''),
  STORAGE_LOCAL_BASE_URL: Joi.string().optional().allow(''),
  STORAGE_ALLOWED_FILE_TYPES: Joi.string().optional().allow(''),

  // S3 / MinIO — required when STORAGE_TYPE=s3
  STORAGE_S3_REGION: Joi.alternatives().conditional('STORAGE_TYPE', {
    is: 's3',
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  STORAGE_S3_BUCKET: Joi.alternatives().conditional('STORAGE_TYPE', {
    is: 's3',
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  STORAGE_S3_ACCESS_KEY_ID: Joi.alternatives().conditional('STORAGE_TYPE', {
    is: 's3',
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  STORAGE_S3_SECRET_ACCESS_KEY: Joi.alternatives().conditional('STORAGE_TYPE', {
    is: 's3',
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  STORAGE_S3_ENDPOINT: Joi.string().uri().optional().allow(''),
  STORAGE_S3_BASE_URL: Joi.string().uri().optional().allow(''),
  STORAGE_S3_FORCE_PATH_STYLE: Joi.string().valid('true', 'false').default('true'),

  // Cloudinary — required when STORAGE_TYPE=cloudinary
  CLOUDINARY_CLOUD_NAME: Joi.alternatives().conditional('STORAGE_TYPE', {
    is: 'cloudinary',
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  CLOUDINARY_API_KEY: Joi.alternatives().conditional('STORAGE_TYPE', {
    is: 'cloudinary',
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  CLOUDINARY_API_SECRET: Joi.alternatives().conditional('STORAGE_TYPE', {
    is: 'cloudinary',
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(''),
  }),

  // Auth — required in production so we don't silently accept anyone.
  AUTH_JWKS_URL: Joi.alternatives().conditional('NODE_ENV', {
    is: isProd,
    then: Joi.string().uri().required(),
    otherwise: Joi.string().uri().optional().allow(''),
  }),
  IAM_INTERNAL_URL: Joi.alternatives().conditional('NODE_ENV', {
    is: isProd,
    then: Joi.string().uri().required(),
    otherwise: Joi.string().uri().optional().allow(''),
  }),
  INTERNAL_API_SECRET: Joi.alternatives().conditional('NODE_ENV', {
    is: isProd,
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().optional().allow(''),
  }),
}).unknown(true);
