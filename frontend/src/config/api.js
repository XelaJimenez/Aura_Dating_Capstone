/**
 * Local `npm run dev` should talk to your local API (matching fixes, seed data).
 * Deployed builds keep Render unless you set VITE_API_URL at build time.
 */
const PRODUCTION_DEFAULT = "https://aura-backend-ysqh.onrender.com";

export const API_BASE_URL =
    (import.meta.env.VITE_API_URL && String(import.meta.env.VITE_API_URL).trim()) ||
    (import.meta.env.DEV ? "http://localhost:4000" : PRODUCTION_DEFAULT);
