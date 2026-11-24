export const SERVICE_WEEKDAYS = Object.freeze([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
]);

export function compatibleWeekdays(shift) {
  return Array.isArray(shift?.compatible_weekdays) ? shift.compatible_weekdays : null;
}

export function runsOnWeekday(shift, day) {
  return SERVICE_WEEKDAYS.includes(day) && compatibleWeekdays(shift)?.includes(day) === true;
}

export function copiedStudyWeekday(shifts, savedDay) {
  const common = SERVICE_WEEKDAYS.filter(day => shifts.every(shift => runsOnWeekday(shift, day)));
  if (savedDay) {
    return { day: common.includes(savedDay) ? savedDay : "", review: !common.includes(savedDay), common };
  }
  return { day: common.length === 1 ? common[0] : "", review: !common.length, common };
}

export function studyWeekdaySummary(params, t) {
  const day = params?.service_weekday;
  if (SERVICE_WEEKDAYS.includes(day)) {
    return t("simulation.service_day_result", { day: t(`simulation.day_${day}`) });
  }
  const common = SERVICE_WEEKDAYS.filter(value => params?.compatible_weekdays?.includes(value));
  if (common.length) {
    return t("simulation.service_day_common", { days: common.map(value => t(`simulation.day_${value}`)).join(", ") });
  }
  return t("simulation.service_day_unavailable");
}
