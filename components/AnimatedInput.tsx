// components/AnimatedInput.tsx
// Text input with a focus-driven border color animation and an
// error shake. Used for name, age fallback, height, weight, etc.

import React, { useEffect, useRef } from "react";
import { TextInput, View, StyleSheet, TextInputProps } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolateColor,
} from "react-native-reanimated";
import { colors, radii, spacing } from "../constants/theme";

interface AnimatedInputProps extends TextInputProps {
  error?: boolean;
}

export default function AnimatedInput({ error, onFocus, onBlur, style, ...rest }: AnimatedInputProps) {
  const focus = useSharedValue(0);
  const shake = useSharedValue(0);
  const errorRef = useRef(error);

  useEffect(() => {
    if (error && !errorRef.current) {
      shake.value = withSequence(
        withTiming(-8, { duration: 60 }),
        withTiming(8, { duration: 60 }),
        withTiming(-6, { duration: 60 }),
        withTiming(0, { duration: 60 })
      );
    }
    errorRef.current = error;
  }, [error]);

  const containerStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focus.value,
      [0, 1],
      [error ? colors.error : colors.surfaceBorder, error ? colors.error : colors.primary]
    ),
    transform: [{ translateX: shake.value }],
  }));

  return (
    <Animated.View style={[styles.wrapper, containerStyle]}>
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          focus.value = withTiming(1, { duration: 200 });
          onFocus?.(e);
        }}
        onBlur={(e) => {
          focus.value = withTiming(0, { duration: 200 });
          onBlur?.(e);
        }}
        {...rest}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1.5,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  input: {
    color: colors.text,
    fontSize: 17,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
});