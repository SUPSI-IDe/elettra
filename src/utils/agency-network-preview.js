const finitePoint = (point) => {
  const lat = Number(point?.lat);
  const lon = Number(point?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
};

export const normalizeAgencyNetworkLines = (lines = []) =>
  (Array.isArray(lines) ? lines : [])
    .map((line) => ({
      ...line,
      points: (Array.isArray(line?.points) ? line.points : [])
        .map(finitePoint)
        .filter(Boolean),
    }))
    .filter((line) => line.points.length >= 2);
