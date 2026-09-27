import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../i18n/I18nProvider';
import { AddHabitScreen } from '../screens/AddHabitScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { HabitsScreen } from '../screens/HabitsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { useAppTheme } from '../theme/ThemeProvider';
import { RootStackParamList, RootTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const ICONS: Record<keyof RootTabParamList, { active: React.ComponentProps<typeof Ionicons>['name']; inactive: React.ComponentProps<typeof Ionicons>['name'] }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Habits: { active: 'checkbox', inactive: 'checkbox-outline' },
  Add: { active: 'add', inactive: 'add' },
  Stats: { active: 'stats-chart', inactive: 'stats-chart-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

export function AppNavigator() {
  const { colors, isDark } = useAppTheme();
  const baseTheme = isDark ? DarkTheme : DefaultTheme;

  const navigationTheme = {
    ...baseTheme,
    dark: isDark,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={TabsNavigator} />
        <Stack.Screen name="Chat" component={ChatScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function TabsNavigator() {
  const { colors, radius } = useAppTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabHorizontalInset = Math.max(16, (width - 680) / 2);
  const tabBarBottom = Platform.OS === 'web' ? 12 : Math.max(insets.bottom, 16);

  return (
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarLabelStyle: styles.label,
          tabBarItemStyle: styles.item,
          tabBarStyle: {
            ...styles.tabBar,
            height: 68,
            start: tabHorizontalInset,
            end: tabHorizontalInset,
            bottom: tabBarBottom,
            paddingBottom: 8,
            backgroundColor: colors.tabBar,
            borderColor: colors.border,
            borderRadius: radius.xl,
            shadowColor: colors.text,
          },
          tabBarIcon: ({ focused, color }) => {
            const name = route.name as keyof RootTabParamList;
            const isAdd = name === 'Add';
            return (
              <View style={isAdd ? [styles.addIcon, { backgroundColor: colors.accent, shadowColor: colors.accent }] : undefined}>
                <Ionicons name={focused ? ICONS[name].active : ICONS[name].inactive} size={isAdd ? 31 : 23} color={isAdd ? colors.white : color} />
              </View>
            );
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('nav.home') }} />
        <Tab.Screen name="Habits" component={HabitsScreen} options={{ tabBarLabel: t('nav.habits') }} />
        <Tab.Screen name="Add" component={AddHabitScreen} options={{ tabBarLabel: t('nav.add') }} />
        <Tab.Screen name="Stats" component={StatsScreen} options={{ tabBarLabel: t('nav.stats') }} />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: t('nav.profile') }} />
      </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderWidth: 1,
    paddingTop: 7,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
  },
  item: { paddingTop: 0 },
  label: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  addIcon: {
    width: 50,
    height: 50,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -12 }],
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 9,
    elevation: 8,
  },
});
