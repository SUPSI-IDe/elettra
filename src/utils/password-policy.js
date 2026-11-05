export const MIN_PASSWORD_LENGTH = 12;

/**
 * The browser enforces the minimum length early. The backend remains the
 * authority for complexity and breach checks, which may evolve independently
 * and must never be weakened by a client-side implementation.
 */
export const meetsPasswordMinimumLength = (password) =>
  typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
