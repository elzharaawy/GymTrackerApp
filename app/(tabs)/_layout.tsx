import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

function TabItem({
  focused,
  iconFocused,
  iconUnfocused,
  label,
}: {
  focused: boolean;
  iconFocused: IconName;
  iconUnfocused: IconName;
  label: string;
}) {
  return (
    <View style={styles.itemWrap}>
      <View style={[styles.iconPill, focused && styles.iconPillActive]}>
        <Ionicons
          name={focused ? iconFocused : iconUnfocused}
          size={22}
          color={focused ? '#ffffff' : '#9ca3af'}
        />
      </View>
      <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabItem focused={focused} iconFocused="home" iconUnfocused="home-outline" label="Home" />
          ),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarIcon: ({ focused }) => (
            <TabItem
              focused={focused}
              iconFocused="barbell"
              iconUnfocused="barbell-outline"
              label="Workout"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ focused }) => (
            <TabItem
              focused={focused}
              iconFocused="stats-chart"
              iconUnfocused="stats-chart-outline"
              label="Stats"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabItem
              focused={focused}
              iconFocused="person"
              iconUnfocused="person-outline"
              label="Profile"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  tabItem: {
    // Removes any native ripple/indicator artifacts under the label
    paddingTop: 0,
  },
  itemWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 56,
  },
  iconPill: {
    width: 44,
    height: 30,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconPillActive: {
    backgroundColor: '#1e1b4b',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
  },
  labelActive: {
    color: '#1e1b4b',
    fontWeight: '700',
  },
});