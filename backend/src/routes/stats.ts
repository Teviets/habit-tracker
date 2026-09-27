import { and, eq, gte, sql } from 'drizzle-orm';
import { FastifyPluginAsync } from 'fastify';

import { db } from '../db/client.js';
import { habitEntries, habits } from '../db/schema.js';
import { sendData } from '../lib/response.js';

export const statsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/stats/overview', {
    schema: { tags: ['Stats'], summary: 'Resumen de progreso y rachas', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const sevenDaysAgo = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    const [habitSummary] = await db.select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${habits.status} = 'active')::int`,
      bestCurrentStreak: sql<number>`coalesce(max(${habits.currentStreak}), 0)::int`,
      bestEverStreak: sql<number>`coalesce(max(${habits.longestStreak}), 0)::int`,
    }).from(habits).where(eq(habits.userId, request.user.sub));

    const activeHabits = await db.select({ id: habits.id, name: habits.name, color: habits.color, daysOfWeek: habits.daysOfWeek })
      .from(habits).where(and(eq(habits.userId, request.user.sub), eq(habits.status, 'active')));
    const entries = await db.select({
      occurredOn: habitEntries.occurredOn,
      habitId: habitEntries.habitId,
      completed: sql<number>`count(*) filter (where ${habitEntries.completed})::int`,
    }).from(habitEntries).where(and(
      eq(habitEntries.userId, request.user.sub),
      gte(habitEntries.occurredOn, sevenDaysAgo),
    )).groupBy(habitEntries.occurredOn, habitEntries.habitId).orderBy(habitEntries.occurredOn);

    const entryMap = new Map(entries.map((entry) => [`${entry.habitId}:${entry.occurredOn}`, entry.completed]));
    const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(Date.now() - (6 - index) * 86_400_000);
      const occurredOn = date.toISOString().slice(0, 10);
      const weekday = ((date.getUTCDay() + 6) % 7) + 1;
      const scheduled = activeHabits.filter((habit) => habit.daysOfWeek.includes(weekday));
      return { occurredOn, completed: scheduled.reduce((sum, habit) => sum + (entryMap.get(`${habit.id}:${occurredOn}`) ?? 0), 0), total: scheduled.length };
    });
    const byHabit = activeHabits.map((habit) => {
      const relevant = lastSevenDays.filter((day) => {
        const date = new Date(`${day.occurredOn}T12:00:00Z`);
        const weekday = ((date.getUTCDay() + 6) % 7) + 1;
        return habit.daysOfWeek.includes(weekday);
      });
      const completed = relevant.reduce((sum, day) => sum + (entryMap.get(`${habit.id}:${day.occurredOn}`) ?? 0), 0);
      return { id: habit.id, name: habit.name, color: habit.color, completed, total: relevant.length, completionRate: relevant.length ? Math.round((completed / relevant.length) * 100) : 0 };
    });

    const totals = lastSevenDays.reduce((acc, day) => ({ completed: acc.completed + day.completed, total: acc.total + day.total }), { completed: 0, total: 0 });
    return sendData(reply, {
      habits: habitSummary ?? { total: 0, active: 0, bestCurrentStreak: 0, bestEverStreak: 0 },
      lastSevenDays,
      byHabit,
      totalCompleted: totals.completed,
      completionRate: totals.total ? Math.round((totals.completed / totals.total) * 100) : 0,
    });
  });
};
