// app/onboarding/summary.tsx
// Q14 "Almost Ready" — animated checkmark reveal of every answer, with
// per-row Edit buttons that jump back into questions.tsx at the right step.
// On Continue: marks onboarding complete in AsyncStorage and routes to
// signup (Firebase logic itself lives untouched in app/signup.tsx).

import React, { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import GradientBackground from "../../components/GradientBackground";
import GlassCard from "../../components/GlassCard";
import { PrimaryButton } from "../../components/AnimatedButton";
import { colors, spacing, typography, radii } from "../../constants/theme";
import { useOnboardingAnswers } from "../../hooks/useOnboardingAnswers";
import {
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  EXPERIENCE_OPTIONS,
  LOCATION_OPTIONS,
  TIME_OPTIONS,
  MUSCLE_OPTIONS,
  EQUIPMENT_OPTIONS,
} from "../../types/onboarding";

function label<T extends string>(options: { value: T; label: string }[], value: T | null) {
  return options.find((o) => o.value === value)?.label ?? "—";
}

function SummaryRow({
  index,
  icon,
  title,
  value,
  onEdit,
}: {
  index: number;
  icon: string;
  title: string;
  value: string;
  onEdit: () => void;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    const delay = 150 + index * 90;
    opacity.value = withDelay(delay, withTiming(1, { duration: 350 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 350 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={style}>
      <GlassCard style={styles.row}>
        <View style={styles.rowLeft}>
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={styles.rowTitle}>{title}</Text>
            <Text style={styles.rowValue}>{value}</Text>
          </View>
        </View>
        <Pressable onPress={onEdit} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Edit ${title}`}>
          <Ionicons name="pencil" size={18} color={colors.textSecondary} />
        </Pressable>
      </GlassCard>
    </Animated.View>
  );
}

export default function SummaryScreen() {
  const router = useRouter();
  const { answers, markOnboardingComplete } = useOnboardingAnswers();

  const editStep = (step: number) => {
    router.push({ pathname: "/onboarding/questions", params: { step: String(step) } } as any);
  };

  const rows = [
    { icon: "person", title: "Name", value: answers.name || "—", step: 1 },
    { icon: "male-female", title: "Gender", value: label(GENDER_OPTIONS, answers.gender), step: 2 },
    { icon: "calendar", title: "Age", value: answers.age !== null ? `${answers.age} years` : "—", step: 3 },
    { icon: "resize", title: "Height", value: answers.height !== null ? `${answers.height} ${answers.heightUnit}` : "—", step: 4 },
    { icon: "scale", title: "Weight", value: answers.weight !== null ? `${answers.weight} ${answers.weightUnit}` : "—", step: 5 },
    { icon: "flag", title: "Goal", value: label(GOAL_OPTIONS, answers.goal), step: 6 },
    { icon: "flash", title: "Experience", value: label(EXPERIENCE_OPTIONS, answers.experience), step: 7 },
    { icon: "location", title: "Location", value: label(LOCATION_OPTIONS, answers.location), step: 8 },
    { icon: "calendar-number", title: "Workout Days", value: answers.workoutDays !== null ? `${answers.workoutDays} days/week` : "—", step: 9 },
    { icon: "time", title: "Preferred Time", value: label(TIME_OPTIONS, answers.workoutTime), step: 10 },
    { icon: "body", title: "Muscle Groups", value: answers.muscleGroups.map((m) => label(MUSCLE_OPTIONS, m)).join(", ") || "—", step: 11 },
    { icon: "barbell", title: "Equipment", value: answers.equipment.map((e) => label(EQUIPMENT_OPTIONS, e)).join(", ") || "—", step: 12 },
    { icon: "notifications", title: "Reminders", value: answers.notifications === "yes" ? "Enabled" : "Later", step: 13 },
  ];

  const handleContinue = async () => {
    await markOnboardingComplete();
    router.push("/signup");
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={typography.title}>Almost Ready 🎉</Text>
          <Text style={[typography.subtitle, styles.subtitle]}>
            Here's everything we've got. Tap the pencil to change anything.
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {rows.map((r, i) => (
            <SummaryRow
              key={r.title}
              index={i}
              icon={r.icon}
              title={r.title}
              value={r.value}
              onEdit={() => editStep(r.step)}
            />
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton label="Continue" onPress={handleContinue} style={styles.continueButton} />
          <Pressable onPress={() => router.push("/login")} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>Already have an account? Log in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    marginBottom: spacing.md,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  rowTitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  rowValue: {
    ...typography.body,
    fontWeight: "600",
    marginTop: 2,
    maxWidth: 220,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  continueButton: {
    width: "100%",
  },
  loginLink: {
    alignItems: "center",
    padding: spacing.sm,
  },
  loginLinkText: {
    ...typography.caption,
    color: colors.secondary,
  },
});