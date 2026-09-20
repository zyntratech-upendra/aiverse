/**
 * Helper utility to safely parse and format event dates and date ranges with full year display.
 */

export const parseDateSafe = (dateStr?: string): Date | null => {
  if (!dateStr || dateStr === "TBD") return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Check ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.split("T")[0].split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  // Check DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    return new Date(y, m - 1, d);
  }

  // Check DD-MMM-YYYY or DD MMM YYYY (e.g. 17-Sep-2026, 17 Sep 2026)
  const dMmmYMatch = trimmed.match(/^(\d{1,2})[-/ ]([a-zA-Z]{3,9})[-/ ](\d{4})$/);
  if (dMmmYMatch) {
    const d = parseInt(dMmmYMatch[1], 10);
    const monthStr = dMmmYMatch[2].toLowerCase();
    const y = parseInt(dMmmYMatch[3], 10);
    const monthNames: Record<string, number> = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
      apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
      aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
      nov: 10, november: 10, dec: 11, december: 11
    };
    if (monthNames[monthStr] !== undefined) {
      return new Date(y, monthNames[monthStr], d);
    }
  }

  // Check MMM DD, YYYY or MMM DD YYYY (e.g. Sep 17, 2026)
  const mmmDYMatch = trimmed.match(/^([a-zA-Z]{3,9})[-/ ](\d{1,2}),?[-/ ](\d{4})$/);
  if (mmmDYMatch) {
    const monthStr = mmmDYMatch[1].toLowerCase();
    const d = parseInt(mmmDYMatch[2], 10);
    const y = parseInt(mmmDYMatch[3], 10);
    const monthNames: Record<string, number> = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
      apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
      aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
      nov: 10, november: 10, dec: 11, december: 11
    };
    if (monthNames[monthStr] !== undefined) {
      return new Date(y, monthNames[monthStr], d);
    }
  }

  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
};

/**
 * Formats a single date or date range to always display start date to end date with the year.
 * Examples:
 * - "2026-09-15", "2026-09-17" -> "15 Sep 2026 - 17 Sep 2026"
 * - "15-Sep-2026", "17-Sep-2026" -> "15 Sep 2026 - 17 Sep 2026"
 * - "2026-09-15", "" -> "15 Sep 2026"
 */
export const formatEventDateRange = (startDateStr?: string, endDateStr?: string): string => {
  const cleanStart = (startDateStr || "").trim();
  const cleanEnd = (endDateStr || "").trim();

  if (!cleanStart || cleanStart === "TBD") {
    if (cleanEnd && cleanEnd !== "TBD") return formatSingleDate(cleanEnd);
    return "TBD";
  }

  const d1 = parseDateSafe(cleanStart);
  const d2 = cleanEnd && cleanEnd !== "TBD" ? parseDateSafe(cleanEnd) : null;

  if (d1 && d2) {
    const formattedStart = `${d1.getDate()} ${d1.toLocaleString("en-US", { month: "short" })} ${d1.getFullYear()}`;
    const formattedEnd = `${d2.getDate()} ${d2.toLocaleString("en-US", { month: "short" })} ${d2.getFullYear()}`;

    if (d1.getTime() === d2.getTime() || formattedStart === formattedEnd) {
      return formattedStart;
    }

    return `${formattedStart} - ${formattedEnd}`;
  }

  if (d1 && !d2) {
    return `${d1.getDate()} ${d1.toLocaleString("en-US", { month: "short" })} ${d1.getFullYear()}`;
  }

  if (!d1 && d2) {
    return `${d2.getDate()} ${d2.toLocaleString("en-US", { month: "short" })} ${d2.getFullYear()}`;
  }

  // Fallback for raw text strings
  if (cleanEnd && cleanEnd !== cleanStart && cleanEnd !== "TBD") {
    const hasYear = /\b20\d\d\b/.test(cleanStart) || /\b20\d\d\b/.test(cleanEnd);
    const suffix = hasYear ? "" : ` ${new Date().getFullYear()}`;
    return `${cleanStart} - ${cleanEnd}${suffix}`;
  }

  return formatSingleDate(cleanStart);
};

export const formatSingleDate = (dateStr: string): string => {
  if (!dateStr || dateStr === "TBD") return "TBD";
  const d = parseDateSafe(dateStr);
  if (d) {
    return `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()}`;
  }
  if (!/\b20\d\d\b/.test(dateStr)) {
    return `${dateStr} ${new Date().getFullYear()}`;
  }
  return dateStr;
};

/**
 * Formats competition round dates into the requested format:
 * e.g., "22,23-oct-26" (startday,endday-month-year) or "24-sep-26" (single day)
 */
export const formatRoundDateRange = (startDateStr?: string, endDateStr?: string): string => {
  const cleanStart = (startDateStr || "").trim();
  const cleanEnd = (endDateStr || "").trim();

  if (!cleanStart || cleanStart === "TBD") {
    if (cleanEnd && cleanEnd !== "TBD") {
      const d = parseDateSafe(cleanEnd);
      if (d) {
        const day = d.getDate();
        const month = d.toLocaleString("en-US", { month: "short" }).toLowerCase();
        const yr = String(d.getFullYear()).slice(-2);
        return `${day}-${month}-${yr}`;
      }
      return cleanEnd;
    }
    return "TBD";
  }

  const d1 = parseDateSafe(cleanStart);
  const d2 = cleanEnd && cleanEnd !== "TBD" ? parseDateSafe(cleanEnd) : null;

  if (d1 && d2) {
    const d1Day = d1.getDate();
    const d2Day = d2.getDate();
    const d1Month = d1.toLocaleString("en-US", { month: "short" }).toLowerCase();
    const d2Month = d2.toLocaleString("en-US", { month: "short" }).toLowerCase();
    const d1Yr = String(d1.getFullYear()).slice(-2);
    const d2Yr = String(d2.getFullYear()).slice(-2);

    // If same day
    if (d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1Day === d2Day) {
      return `${d1Day}-${d1Month}-${d1Yr}`;
    }

    // If same month and same year (e.g. 22,23-oct-26 or 24,25-sep-26)
    if (d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()) {
      return `${d1Day},${d2Day}-${d1Month}-${d1Yr}`;
    }

    // If different months, same year (e.g. 28-sep,2-oct-26)
    if (d1.getFullYear() === d2.getFullYear()) {
      return `${d1Day}-${d1Month},${d2Day}-${d2Month}-${d1Yr}`;
    }

    // If different years (e.g. 28-dec-25,2-jan-26)
    return `${d1Day}-${d1Month}-${d1Yr},${d2Day}-${d2Month}-${d2Yr}`;
  }

  if (d1 && !d2) {
    const day = d1.getDate();
    const month = d1.toLocaleString("en-US", { month: "short" }).toLowerCase();
    const yr = String(d1.getFullYear()).slice(-2);
    return `${day}-${month}-${yr}`;
  }

  return cleanStart;
};
