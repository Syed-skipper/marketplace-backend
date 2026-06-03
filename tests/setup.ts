process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5432/marketplace_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-minimum-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-characters-long';
process.env.CSRF_ENABLED = 'false';
