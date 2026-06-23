// Set required env vars before any module imports
process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
process.env.JWT_SECRET = "test-jwt-secret-32-chars-minimum!";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-32-chars-min!";
process.env.GROQ_API_KEY = "gsk_test";
process.env.GEMINI_API_KEY = "AIza_test";
process.env.NODE_ENV = "test";
process.env.FRONTEND_URL = "http://localhost:5173";
