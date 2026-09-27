import { apiRequest } from '../../config/api';

export type HabitFrequency = 'daily' | 'weekly' | 'custom';
export type HabitStatus = 'active' | 'paused' | 'archived';

export type Habit = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  daysOfWeek: number[];
  targetCount: number;
  unit: string;
  reminderTime: string | null;
  startDate: string;
  status: HabitStatus;
  privacy: 'private' | 'group' | 'public';
  habitGroupId: string | null;
  currentStreak: number;
  longestStreak: number;
};

export type HabitInput = Pick<Habit, 'name' | 'icon' | 'color' | 'frequency' | 'daysOfWeek' | 'targetCount' | 'unit'> & {
  description?: string | null;
  reminderTime?: string | null;
  habitGroupId?: string | null;
  status?: HabitStatus;
  privacy?: 'private' | 'public';
};

export type HabitGroup = { id: string; name: string; color: string; icon: string };
export type StatsOverview = {
  habits: { total: number; active: number; bestCurrentStreak: number; bestEverStreak: number };
  lastSevenDays: { occurredOn: string; completed: number; total: number }[];
  byHabit: { id: string; name: string; color: string; completed: number; total: number; completionRate: number }[];
  totalCompleted: number;
  completionRate: number;
};

function authenticated<T>(token: string, path: string, init: RequestInit = {}) {
  return apiRequest<T>(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
}

export const habitApi = {
  list: (token: string) => authenticated<Habit[]>(token, '/habits?status=active'),
  create: (token: string, input: HabitInput) => authenticated<Habit>(token, '/habits', { method: 'POST', body: JSON.stringify(input) }),
  update: (token: string, id: string, input: Partial<HabitInput>) => authenticated<Habit>(token, `/habits/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (token: string, id: string) => authenticated<void>(token, `/habits/${id}`, { method: 'DELETE' }),
  checkIn: (token: string, id: string, completed: boolean, occurredOn: string) => authenticated<{ entry: { completed: boolean }; streak: number }>(token, `/habits/${id}/check-ins`, { method: 'PUT', body: JSON.stringify({ occurredOn, completed, value: completed ? 1 : 0 }) }),
  checkIns: (token: string, id: string, occurredOn: string) => authenticated<{ completed: boolean }[]>(token, `/habits/${id}/check-ins?from=${occurredOn}&to=${occurredOn}`),
  overview: (token: string) => authenticated<StatsOverview>(token, '/stats/overview'),
  listGroups: (token: string) => authenticated<HabitGroup[]>(token, '/habit-groups'),
  createGroup: (token: string, input: Pick<HabitGroup, 'name' | 'color' | 'icon'>) => authenticated<HabitGroup>(token, '/habit-groups', { method: 'POST', body: JSON.stringify(input) }),
  updateGroup: (token: string, id: string, input: Partial<Pick<HabitGroup, 'name' | 'color' | 'icon'>>) => authenticated<HabitGroup>(token, `/habit-groups/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  removeGroup: (token: string, id: string) => authenticated<void>(token, `/habit-groups/${id}`, { method: 'DELETE' }),
};
