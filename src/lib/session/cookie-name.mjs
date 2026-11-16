// The session cookie's name, alone in a file so the middleware can import it
// without pulling node:crypto (core.mjs) into its bundle.
export const COOKIE_NAME = "__Host-jn_session";
