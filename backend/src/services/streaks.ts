import { and, asc, eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { habitEntries, habits } from '../db/schema.js';

const DAY_MS = 86_400_000;

function utcDay(date: string | Date) {
  const value = typeof date === 'string' ? `${date}T00:00:00.000Z` : date;
  const parsed = new Date(value);
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()) / DAY_MS;
}

export async function recalculateHabitStreak(habitId: string, userId: string) {
  const entries = await db.select({ occurredOn: habitEntries.occurredOn })
    .from(habitEntries)
    .where(and(eq(habitEntries.habitId, habitId), eq(habitEntries.userId, userId), eq(habitEntries.completed, true)))
    .orderBy(asc(habitEntries.occurredOn));

  const days = [...new Set(entries.map((entry) => utcDay(entry.occurredOn)))];
  let longest = 0;
  let run = 0;
  let previous: number | undefined;
  for (const day of days) {
    run = previous !== undefined && day === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  const today = utcDay(new Date());
  const latest = days.at(-1);
  let current = latest !== undefined && latest >= today - 1 ? 1 : 0;
  if (current) {
    for (let index = days.length - 2; index >= 0; index -= 1) {
      if (days[index] === days[index + 1]! - 1) current += 1;
      else break;
    }
  }

  await db.update(habits).set({ currentStreak: current, longestStreak: longest, updatedAt: new Date() })
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));
  return { currentStreak: current, longestStreak: longest };
}
