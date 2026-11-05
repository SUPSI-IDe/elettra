const viteEnvironment = import.meta.env ?? {};

export const API_ROOT = (viteEnvironment.VITE_API_ROOT ?? "").replace(
  /\/$/,
  ""
);
