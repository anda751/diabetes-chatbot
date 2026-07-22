const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
const localApiUrl = `${window.location.protocol}//${window.location.hostname}:5000/api`;

const fallbackApiUrl = import.meta.env.DEV
  ? localApiUrl
  : isLocalHost
    ? localApiUrl
    : "/api";

export const API_URL = configuredApiUrl || fallbackApiUrl;
