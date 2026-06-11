export const calculateAvailableMinutes = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const diffMinutes = (end - start) / 1000 / 60;

  return diffMinutes;
};
