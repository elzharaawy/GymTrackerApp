// app/onboarding/slides.tsx
// 5-slide onboarding carousel. On finish, routes into the question flow
// (app/onboarding/questions.tsx — next phase). "Skip" jumps straight there too.
// Firebase is untouched here; this screen only collects nothing and persists nothing yet.

import React, { useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import PagerView from "react-native-pager-view";
import { SafeAreaView } from "react-native-safe-area-context";

import GradientBackground from "../../components/GradientBackground";
import OnboardingSlide, { SlideData } from "../../components/OnboardingSlide";
import ProgressDots from "../../components/ProgressDots";
import { PrimaryButton, SecondaryButton } from "../../components/AnimatedButton";
import { colors, spacing, typography } from "../../constants/theme";

const SLIDES: SlideData[] = [
  {
    icon: "fitness",
    title: "Welcome to Gym Tracker",
    description: "Track every workout with precision.",
  },
  {
    icon: "barbell",
    title: "Workout Tracking",
    description: "Log sets, reps, weight, rest timers, and notes effortlessly.",
  },
  {
    icon: "stats-chart",
    title: "Analytics",
    description: "Watch your strength improve with beautiful charts and personal records.",
  },
  {
    icon: "trophy",
    title: "Achievements",
    description: "Unlock streaks, milestones, badges, and celebrate every success.",
  },
  {
    icon: "sparkles",
    title: "AI Coach",
    description: "Receive personalized recommendations based on your progress.",
  },
];

export default function OnboardingSlidesScreen() {
  const router = useRouter();
  const pagerRef = useRef<PagerView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isLast = activeIndex === SLIDES.length - 1;

  const goToQuestions = () => {
    // Next phase: app/onboarding/questions.tsx
    router.push("/onboarding/questions" as any);
  };

  const handleNext = () => {
    if (isLast) {
      goToQuestions();
    } else {
      pagerRef.current?.setPage(activeIndex + 1);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      pagerRef.current?.setPage(activeIndex - 1);
    }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topRow}>
          <ProgressDots count={SLIDES.length} activeIndex={activeIndex} />
          <Text style={styles.skip} onPress={goToQuestions}>
            Skip
          </Text>
        </View>

        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={0}
          onPageSelected={(e) => setActiveIndex(e.nativeEvent.position)}
        >
          {SLIDES.map((slide, i) => (
            <View key={slide.title} style={styles.pagerItem}>
              <OnboardingSlide slide={slide} isActive={i === activeIndex} />
            </View>
          ))}
        </PagerView>

        <View style={styles.controls}>
          {activeIndex > 0 ? (
            <SecondaryButton label="Back" onPress={handlePrev} style={styles.controlButton} />
          ) : (
            <View style={styles.controlButton} />
          )}
          <PrimaryButton
            label={isLast ? "Finish" : "Next"}
            onPress={handleNext}
            style={styles.controlButton}
          />
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  skip: {
    ...typography.caption,
    color: colors.textSecondary,
    padding: spacing.sm,
  },
  pager: {
    flex: 1,
  },
  pagerItem: {
    flex: 1,
  },
  controls: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  controlButton: {
    flex: 1,
  },
});