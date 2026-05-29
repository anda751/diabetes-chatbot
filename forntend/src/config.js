const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

const fallbackApiUrl = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:5000/api`
  : '/api';

export const API_URL = configuredApiUrl || fallbackApiUrl;
