// components/ChipSelector.tsx
// Generic wrapping row of selectable chips. Supports single or multi select
// and is reused for workout days, muscle groups, equipment, and unit toggles.

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, radii, spacing, typography } from "../constants/theme";

export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
}

interface ChipSelectorProps<T extends string | number> {
  options: ChipOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
}

function Chip<T extends string | number>({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(active ? 1 : 0);
  React.useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active]);

  const style = useAnimatedStyle(() => ({
    backgroundColor: active ? colors.primary : colors.surface,
    borderColor: active ? colors.primary : colors.surfaceBorder,
  }));

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <Animated.View style={[styles.chip, style]}>
        <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function ChipSelector<T extends string | number>({
  options,
  selected,
  onToggle,
}: ChipSelectorProps<T>) {
  return (
    <View style={styles.wrap}>
      {options.map((opt) => (
        <Chip
          key={String(opt.value)}
          label={opt.label}
          active={selected.includes(opt.value)}
          onPress={() => onToggle(opt.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: radii.full,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  chipLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  chipLabelActive: {
    color: "#0B1220",
  },
});