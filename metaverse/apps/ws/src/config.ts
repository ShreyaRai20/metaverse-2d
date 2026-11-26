// Must be the same secret the http app uses to sign tokens.
export const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";