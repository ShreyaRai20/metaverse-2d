// Must be the same secret the Next.js app uses to sign tokens.
export const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

// Base URL of the Next.js API (it owns the database).
export const API_URL = process.env.API_URL || "http://localhost:3000/api/v1";