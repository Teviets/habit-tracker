import type { Habit } from '../features/habits/api';

export type RootTabParamList = {
  Home: undefined;
  Habits: undefined;
  Add: { habit?: Habit } | undefined;
  Stats: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  Chat: undefined;
};
