// components/OnboardingSlide.tsx
// A single slide's content: animated icon + title + description.
// Designed to sit inside a PagerView page.

import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import GlassCard from "./GlassCard";
import { colors, typography, spacing, radii } from "../constants/theme";

export interface SlideData {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

interface OnboardingSlideProps {
  slide: SlideData;
  isActive: boolean;
}

export default function OnboardingSlide({ slide, isActive }: OnboardingSlideProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);

  useEffect(() => {
    if (isActive) {
      opacity.value = withDelay(100, withTiming(1, { duration: 400 }));
      scale.value = withDelay(100, withTiming(1, { duration: 400 }));
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.85, { duration: 200 });
    }
  }, [isActive]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.page}>
      <Animated.View style={[styles.iconWrap, style]}>
        <GlassCard style={styles.iconCard}>
          <Ionicons name={slide.icon} size={64} color={colors.primary} />
        </GlassCard>
      </Animated.View>

      <Animated.View style={style}>
        <Text style={[typography.title, styles.title]}>{slide.title}</Text>
        <Text style={[typography.subtitle, styles.description]}>{slide.description}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    marginBottom: spacing.xl,
  },
  iconCard: {
    width: 160,
    height: 160,
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  description: {
    textAlign: "center",
    lineHeight: 22,
  },
});