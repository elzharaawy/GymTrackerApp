// components/GlassCard.tsx
// Reusable glassmorphism container: blurred, translucent, soft-bordered.

import React from "react";
import { StyleSheet, View, ViewStyle, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { colors, radii } from "../constants/theme";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
}

export default function GlassCard({ children, style, intensity = 30 }: GlassCardProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <BlurView
        intensity={intensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: Platform.OS === "android" ? "rgba(17,24,39,0.85)" : colors.surface,
  },
  content: {
    padding: 16,
  },
});