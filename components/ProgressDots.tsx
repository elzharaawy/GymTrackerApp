// components/ProgressDots.tsx
// Animated pagination dots. The active dot expands into a pill.

import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { colors, radii } from "../constants/theme";

interface ProgressDotsProps {
  count: number;
  activeIndex: number;
}

function Dot({ active }: { active: boolean }) {
  const width = useSharedValue(active ? 24 : 8);
  const opacity = useSharedValue(active ? 1 : 0.4);

  useEffect(() => {
    width.value = withTiming(active ? 24 : 8, { duration: 250 });
    opacity.value = withTiming(active ? 1 : 0.4, { duration: 250 });
  }, [active]);

  const style = useAnimatedStyle(() => ({
    width: width.value,
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

export default function ProgressDots({ count, activeIndex }: ProgressDotsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <Dot key={i} active={i === activeIndex} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
});