// components/ProgressHeader.tsx
// Shared header for every question step: back button, animated progress bar,
// and a "Step X of N" label.

import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radii, typography } from "../constants/theme";

interface ProgressHeaderProps {
  step: number; // 1-indexed
  total: number;
  onBack?: () => void;
}

export default function ProgressHeader({ step, total, onBack }: ProgressHeaderProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(step / total, { duration: 350 });
  }, [step, total]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          onPress={onBack}
          disabled={!onBack}
          hitSlop={12}
          style={[styles.backButton, !onBack && styles.hidden]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.stepLabel}>
          Step {step} of {total}
        </Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, barStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  hidden: {
    opacity: 0,
  },
  stepLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  track: {
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
});