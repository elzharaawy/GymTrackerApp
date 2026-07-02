// components/QuestionCard.tsx
// Selectable card with an icon + label, used for gender, goal,
// experience, location, and yes/later style single-choice questions.
// Renders in a wrapping grid — pass `style={{ width: "48%" }}` etc.
// from the parent for layout control.

import React, { useEffect } from "react";
import { Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../constants/theme";

interface QuestionCardProps {
  icon: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export default function QuestionCard({ icon, label, selected, onPress, style }: QuestionCardProps) {
  const scale = useSharedValue(1);
  const borderProgress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    borderProgress.value = withTiming(selected ? 1 : 0, { duration: 200 });
  }, [selected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: selected ? colors.primary : colors.surfaceBorder,
    backgroundColor: selected ? "rgba(34,197,94,0.12)" : colors.surface,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (scale.value = withSpring(0.96, { damping: 15, stiffness: 300 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 12, stiffness: 250 }))}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.card, animatedStyle, style]}>
        <Ionicons
          name={icon as any}
          size={28}
          color={selected ? colors.primary : colors.textSecondary}
        />
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
        {selected && (
          <Ionicons
            name="checkmark-circle"
            size={18}
            color={colors.primary}
            style={styles.check}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: radii.lg,
    paddingVertical: 20,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 100,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    fontWeight: "600",
  },
  labelSelected: {
    color: colors.text,
  },
  check: {
    position: "absolute",
    top: 8,
    right: 8,
  },
});