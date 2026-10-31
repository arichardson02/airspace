// The website's motion: things rise into place with a long quint ease.
export const ease = [0.22, 1, 0.36, 1] as const;

export const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease, delay },
});
