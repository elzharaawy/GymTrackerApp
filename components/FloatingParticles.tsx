// components/FloatingParticles.tsx
// A handful of small dots that drift upward and fade, looping.
// Kept intentionally cheap (few nodes) to hold 60fps on the Welcome screen.

import React, { useEffect, useMemo } from "react";
import { StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { colors } from "../constants/theme";

const { width, height } = Dimensions.get("window");
const PARTICLE_COUNT = 14;

function Particle({ delay, x, size }: { delay: number; x: number; size: number }) {
  const translateY = useSharedValue(height * 0.1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-height * 0.15, { duration: 6000, easing: Easing.linear }),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(withTiming(0.6, { duration: 3000 }), -1, true)
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: x,
          bottom: 0,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primary,
        },
        style,
      ]}
    />
  );
}

export default function FloatingParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
        key: i,
        x: Math.random() * width,
        size: 3 + Math.random() * 4,
        delay: Math.random() * 4000,
      })),
    []
  );

  return (
    <>
      {particles.map((p) => (
        <Particle key={p.key} delay={p.delay} x={p.x} size={p.size} />
      ))}
    </>
  );
}