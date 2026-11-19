// GTFS hours can exceed 23. Time inputs are clock times; retain the service-day
// offset at API/filter boundaries rather than truncating an overnight shift.
export const toClockTime = (value = '') => {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value));
  return match ? `${String(Number(match[1]) % 24).padStart(2, '0')}:${match[2]}` : '';
};

export const resolveShiftEndTime = (start = '', end = '') => {
  if (!start || !end) return end;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  if (endHour * 60 + endMinute < startHour * 60 + startMinute) {
    return `${String(endHour + 24).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
  }
  return end;
};
