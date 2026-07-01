// components/AnimatedButton.tsx
// Base animated button: scales down on press, optional gradient fill.
// PrimaryButton / SecondaryButton (below) wrap this with preset styles.

import React from "react";
import { Text, StyleSheet, ViewStyle, TextStyle, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { colors, radii, typography } from "../constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export default function AnimatedButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  style,
  textStyle,
  icon,
}: AnimatedButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 250 });
  };

  const content = (
    <>
      {icon}
      <Text
        style={[
          styles.label,
          variant === "primary" && { color: "#0B1220" },
          variant === "secondary" && { color: colors.text },
          variant === "ghost" && { color: colors.textSecondary },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </>
  );

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[animatedStyle, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {variant === "primary" ? (
        <LinearGradient
          colors={colors.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, styles.row, style]}
        >
          {content}
        </LinearGradient>
      ) : (
        <Animated.View
          style={[
            styles.base,
            styles.row,
            variant === "secondary" && styles.secondaryBase,
            variant === "ghost" && styles.ghostBase,
            style,
          ]}
        >
          {content}
        </Animated.View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryBase: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  ghostBase: {
    backgroundColor: "transparent",
  },
  label: {
    ...typography.body,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.5,
  },
});

export function PrimaryButton(props: Omit<AnimatedButtonProps, "variant">) {
  return <AnimatedButton {...props} variant="primary" />;
}

export function SecondaryButton(props: Omit<AnimatedButtonProps, "variant">) {
  return <AnimatedButton {...props} variant="secondary" />;
}