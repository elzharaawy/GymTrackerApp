// components/StatCard.tsx
// Small glass stat pill that fades + slides in with a configurable delay,
// used in a staggered row on the Welcome screen.

import React, { useEffect } from "react";
import { Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import GlassCard from "./GlassCard";
import { colors, typography } from "../constants/theme";

interface StatCardProps {
  emoji: string;
  label: string;
  delay: number;
}

export default function StatCard({ emoji, label, delay }: StatCardProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 400 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.wrapper, style]}>
      <GlassCard style={styles.card}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.label}>{label}</Text>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "48%",
  },
  card: {
    alignItems: "center",
    paddingVertical: 18,
  },
  emoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  label: {
    ...typography.caption,
    color: colors.text,
    textAlign: "center",
  },
});