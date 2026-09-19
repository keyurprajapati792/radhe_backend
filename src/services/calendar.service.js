import ProductionSlot from "../models/productionSlot.model.js";

const RED_THRESHOLD = 0.9;
const DAY_MS = 24 * 60 * 60 * 1000;

function getOccupancyLevel(busyMs, dayMs) {
  if (dayMs <= 0) return "green";
  const ratio = busyMs / dayMs;
  if (ratio >= RED_THRESHOLD) return "red";
  if (ratio > 0) return "yellow";
  return "green";
}

function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];
  for (const cur of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else merged.push(cur);
  }
  return merged;
}

// For a given resource, compute occupancy per calendar day across [rangeStart, rangeEnd)
function computeDailyOccupancy(groupItems, rangeStart, rangeEnd) {
  const dailyLevels = new Map(); // dayKey (ms of day start) -> level

  let dayStart = new Date(rangeStart);
  dayStart.setHours(0, 0, 0, 0);

  while (dayStart.getTime() < rangeEnd) {
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const clippedStart = Math.max(dayStart.getTime(), rangeStart);
    const clippedEnd = Math.min(dayEnd.getTime(), rangeEnd);

    const clipped = groupItems
      .map((i) => ({
        start: Math.max(new Date(i.start).getTime(), clippedStart),
        end: Math.min(new Date(i.end).getTime(), clippedEnd),
      }))
      .filter((i) => i.end > i.start);

    const busyMs = mergeIntervals(clipped).reduce(
      (sum, i) => sum + (i.end - i.start),
      0,
    );
    dailyLevels.set(
      dayStart.getTime(),
      getOccupancyLevel(busyMs, clippedEnd - clippedStart),
    );

    dayStart = dayEnd;
  }

  return dailyLevels;
}

// Rank so an item spanning multiple days shows the "worst" (busiest) level it touches
const LEVEL_RANK = { green: 0, yellow: 1, red: 2 };

function levelForItem(item, dailyLevels) {
  const itemStart = new Date(item.start).getTime();
  const itemEnd = new Date(item.end).getTime();

  let worst = "green";
  let dayStart = new Date(itemStart);
  dayStart.setHours(0, 0, 0, 0);

  while (dayStart.getTime() < itemEnd) {
    const level = dailyLevels.get(dayStart.getTime());
    if (level && LEVEL_RANK[level] > LEVEL_RANK[worst]) worst = level;
    dayStart = new Date(dayStart.getTime() + DAY_MS);
  }

  return worst;
}

class CalendarService {
  async getResourceCalendar(query) {
    const { start, end, resource = "machine", locationId } = query;

    if (!start || !end) {
      return {
        success: false,
        statustype: "BAD_REQUEST",
        message: "start and end dates are required",
      };
    }

    const rangeStart = new Date(start).getTime();
    const rangeEnd = new Date(end).getTime();

    const baseFilter = {
      plannedStartTime: { $lte: new Date(end) },
      plannedEndTime: { $gte: new Date(start) },
    };

    let events;

    if (resource === "machine") {
      const slots = await ProductionSlot.find(baseFilter)
        .populate({ path: "jobId", select: "name ref_code status locationId" })
        .populate("machineId", "name machineNumber")
        .populate({
          path: "jobStepId",
          populate: { path: "processId", select: "name" },
        });

      const filtered = locationId
        ? slots.filter((s) => s.jobId?.locationId === Number(locationId))
        : slots;

      events = filtered
        .filter((s) => s.machineId)
        .map((s) => ({
          id: s._id.toString(),
          resourceId: s.machineId._id.toString(),
          resourceName: `${s.machineId.machineNumber ? s.machineId.machineNumber + " - " : ""}${s.machineId.name}`,
          jobNumber: s.jobId?.ref_code,
          jobName: s.jobId?.name,
          process: s.jobStepId?.processId?.name,
          start: s.plannedStartTime,
          end: s.plannedEndTime,
          status: s.status,
        }));
    } else {
      const slots = await ProductionSlot.find(baseFilter)
        .populate({ path: "jobId", select: "name ref_code status locationId" })
        .populate({
          path: "jobStepId",
          populate: { path: "processId", select: "name" },
        })
        .populate("workers.workerId", "firstName middleName lastName");

      const filtered = locationId
        ? slots.filter((s) => s.jobId?.locationId === Number(locationId))
        : slots;

      events = [];
      for (const slot of filtered) {
        for (const worker of slot.workers || []) {
          if (!worker.workerId) continue;
          events.push({
            id: `${slot._id}-${worker.workerId._id}`,
            resourceId: worker.workerId._id.toString(),
            resourceName: [
              worker.workerId.firstName,
              worker.workerId.middleName,
              worker.workerId.lastName,
            ]
              .filter(Boolean)
              .join(" "),
            jobNumber: slot.jobId?.ref_code,
            jobName: slot.jobId?.name,
            process: slot.jobStepId?.processId?.name,
            start: slot.plannedStartTime,
            end: slot.plannedEndTime,
            status: slot.status,
          });
        }
      }
    }

    const groupMap = new Map();
    const itemsByGroup = new Map();
    for (const e of events) {
      if (!groupMap.has(e.resourceId))
        groupMap.set(e.resourceId, {
          id: e.resourceId,
          content: e.resourceName,
        });
      if (!itemsByGroup.has(e.resourceId)) itemsByGroup.set(e.resourceId, []);
      itemsByGroup.get(e.resourceId).push(e);
    }

    // Precompute daily occupancy per resource, then tag each item with its level
    const dailyLevelsByGroup = new Map();
    for (const [resourceId, groupItems] of itemsByGroup.entries()) {
      dailyLevelsByGroup.set(
        resourceId,
        computeDailyOccupancy(groupItems, rangeStart, rangeEnd),
      );
    }

    const items = events.map((e) => {
      const dailyLevels = dailyLevelsByGroup.get(e.resourceId);
      const level = levelForItem(e, dailyLevels);

      return {
        id: e.id,
        group: e.resourceId,
        content: e.jobNumber || "",
        start: e.start,
        end: e.end,
        jobNumber: e.jobNumber,
        jobName: e.jobName,
        process: e.process,
        status: e.status,
        occupancy: level,
        className: `occupancy-${level}`,
      };
    });

    return {
      success: true,
      statustype: "OK",
      data: { groups: [...groupMap.values()], items },
    };
  }
}

export default new CalendarService();
