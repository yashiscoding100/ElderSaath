export type DurationUnit = "DAYS" | "WEEKS" | "MONTHS"

export function calculateEndDate(
  startDate: Date = new Date(),
  durationValue?: number | null,
  durationUnit?: string | null
): Date | null {
  if (!durationValue || durationValue <= 0 || !durationUnit) {
    return null
  }

  const end = new Date(startDate.getTime())
  const val = Math.floor(durationValue)

  if (durationUnit === "DAYS") {
    end.setDate(end.getDate() + val)
  } else if (durationUnit === "WEEKS") {
    end.setDate(end.getDate() + val * 7)
  } else if (durationUnit === "MONTHS") {
    end.setMonth(end.getMonth() + val)
  } else {
    return null
  }

  // Set to end of the day 23:59:59 so the full final day is included
  end.setHours(23, 59, 59, 999)
  return end
}

export function formatDurationSummary(
  durationValue?: number | null,
  durationUnit?: string | null,
  endDate?: Date | string | null
): string | null {
  if (!endDate) return null

  const end = new Date(endDate)
  const formattedDate = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  })

  const now = new Date()
  const isExpired = now.getTime() > end.getTime()

  if (isExpired) {
    return `Course ended on ${formattedDate}`
  }

  if (durationValue && durationUnit) {
    const unitLabel = durationValue === 1 
      ? durationUnit.slice(0, -1).toLowerCase() 
      : durationUnit.toLowerCase()
    return `${durationValue} ${unitLabel} (until ${formattedDate})`
  }

  return `Until ${formattedDate}`
}

export function isMedicationExpired(endDate?: Date | string | null): boolean {
  if (!endDate) return false
  const end = new Date(endDate)
  return new Date().getTime() > end.getTime()
}
