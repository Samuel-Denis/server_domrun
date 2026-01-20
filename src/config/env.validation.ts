import * as Joi from 'joi';

/**
 * Schema de validação para variáveis de ambiente
 * 
 * Em produção (NODE_ENV=production), todas as variáveis obrigatórias
 * devem estar presentes ou a aplicação falhará ao iniciar.
 */
export const envValidationSchema = Joi.object({
  // Node Environment
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // Database - OBRIGATÓRIO
  DATABASE_URL: Joi.string()
    .required()
    .messages({
      'any.required': 'DATABASE_URL é obrigatória',
      'string.empty': 'DATABASE_URL não pode estar vazia',
    }),

  // JWT - OBRIGATÓRIO
  JWT_SECRET: Joi.string()
    .min(32) // Segurança: JWT secret deve ter pelo menos 32 caracteres
    .required()
    .messages({
      'any.required': 'JWT_SECRET é obrigatório',
      'string.empty': 'JWT_SECRET não pode estar vazio',
      'string.min': 'JWT_SECRET deve ter no mínimo 32 caracteres',
    }),

  // Opcionais
  PORT: Joi.number().default(3000),
  
  // Map Matching (opcional)
  MAPBOX_ACCESS_TOKEN: Joi.string().optional().allow(''),
  
  // CORS Origins (opcional, obrigatório em produção se especificado)
  // Formato: "https://app.com,https://admin.app.com" (separado por vírgula)
  CORS_ORIGINS: Joi.string().optional().allow(''),
});

/**
 * Valida e retorna as variáveis de ambiente
 * Em produção, lança erro se variáveis obrigatórias estiverem ausentes
 */
export function validateEnv() {
  const { error, value } = envValidationSchema.validate(process.env, {
    allowUnknown: true, // Permite outras variáveis não definidas no schema
    stripUnknown: true, // Remove variáveis não definidas do resultado
    abortEarly: false, // Retorna todos os erros, não apenas o primeiro
  });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message).join('\n');
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Variáveis obrigatórias (DATABASE_URL, JWT_SECRET) devem sempre estar presentes
    // Em produção, sempre falhar. Em desenvolvimento, também falhar para evitar erros silenciosos
    throw new Error(
      `❌ Erro de validação de variáveis de ambiente${isProduction ? ' (PRODUÇÃO)' : ''}:\n${errorMessages}`
    );
  }

  return value;
}
