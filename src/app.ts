import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { corsOrigins, env } from './config/env';
import { requestLoggerMiddleware } from './common/middlewares/request-logger.middleware';
import { apiVersionMiddleware } from './common/middlewares/api-version.middleware';
import { errorMiddleware } from './common/middlewares/error.middleware';
import { idempotencyMiddleware } from './common/middlewares/idempotency.middleware';
import v1Routes from './routes/v1';
import v2Routes from './routes/v2';
import { swaggerSpec } from './config/swagger/swagger.config';

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: env.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-CSRF-Token'],
}));

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(requestLoggerMiddleware);
app.use(apiVersionMiddleware);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests' },
});
app.use('/api', limiter);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'OK', data: { status: 'healthy', version: '1.0.0' } });
});

app.use('/api/v1', idempotencyMiddleware, v1Routes);
app.use('/api/v2', idempotencyMiddleware, v2Routes);

app.use(errorMiddleware);

export default app;
