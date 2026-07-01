// components/GradientBackground.tsx
// Full-screen animated gradient backdrop with slow-drifting glow orbs.
// Wrap any screen's content with this instead of a flat colored View.

import React, { useEffect } from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { colors } from "../constants/theme";

const { width, height } = Dimensions.get("window");

interface GradientBackgroundProps {
  children?: React.ReactNode;
}

function GlowOrb({
  size,
  top,
  left,
  color,
  duration,
}: {
  size: number;
  top: number;
  left: number;
  color: string;
  duration: number;
}) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(20, { duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(-20, { duration, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: duration * 0.8 }),
        withTiming(0.4, { duration: duration * 0.8 })
      ),
      -1,
      true
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
          top,
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export default function GradientBackground({ children }: GradientBackgroundProps) {
  return (
    <View style={styles.container}>
      <LinearGradient colors={colors.gradientBg} style={StyleSheet.absoluteFill} />

      <GlowOrb size={220} top={-40} left={width - 160} color="rgba(34,197,94,0.25)" duration={4000} />
      <GlowOrb size={180} top={height * 0.35} left={-80} color="rgba(59,130,246,0.2)" duration={5000} />
      <GlowOrb size={160} top={height * 0.75} left={width * 0.6} color="rgba(245,158,11,0.15)" duration={4500} />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});