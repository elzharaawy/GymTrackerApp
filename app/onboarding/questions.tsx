// app/onboarding/questions.tsx
// Controller for the 13-question flow (Q14 "Almost Ready" lives in summary.tsx).
// Supports jumping to a specific step via ?step=N (used by summary's Edit buttons).
// Answers persist to AsyncStorage on every change via useOnboardingAnswers.
//
// NOTE: step 3 (WheelPicker) renders in a plain View, not inside the
// ScrollView used for the other steps — WheelPicker uses a vertical
// FlatList internally, and nesting two same-orientation scrollers throws
// "VirtualizedLists should never be nested inside plain ScrollViews".

import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, SlideInRight, SlideOutLeft } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import GradientBackground from "../../components/GradientBackground";
import ProgressHeader from "../../components/ProgressHeader";
import AnimatedInput from "../../components/AnimatedInput";
import QuestionCard from "../../components/QuestionCard";
import ChipSelector from "../../components/ChipSelector";
import WheelPicker from "../../components/WheelPicker";
import { PrimaryButton, SecondaryButton } from "../../components/AnimatedButton";
import { colors, spacing, typography } from "../../constants/theme";
import { useOnboardingAnswers } from "../../hooks/useOnboardingAnswers";
import {
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  EXPERIENCE_OPTIONS,
  LOCATION_OPTIONS,
  TIME_OPTIONS,
  MUSCLE_OPTIONS,
  EQUIPMENT_OPTIONS,
  WORKOUT_DAYS_OPTIONS,
  TOTAL_QUESTION_STEPS,
} from "../../types/onboarding";

export default function QuestionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ step?: string }>();
  const { answers, updateAnswer, toggleArrayValue } = useOnboardingAnswers();

  const [step, setStep] = useState(() => {
    const parsed = params.step ? parseInt(params.step, 10) : 1;
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= TOTAL_QUESTION_STEPS ? parsed : 1;
  });

  useEffect(() => {
    if (params.step) {
      const parsed = parseInt(params.step, 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= TOTAL_QUESTION_STEPS) {
        setStep(parsed);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.step]);

  const isValid = useMemo(() => {
    switch (step) {
      case 1:
        return answers.name.trim().length > 0;
      case 2:
        return answers.gender !== null;
      case 3:
        return answers.age !== null;
      case 4:
        return answers.height !== null && answers.height > 0;
      case 5:
        return answers.weight !== null && answers.weight > 0;
      case 6:
        return answers.goal !== null;
      case 7:
        return answers.experience !== null;
      case 8:
        return answers.location !== null;
      case 9:
        return answers.workoutDays !== null;
      case 10:
        return answers.workoutTime !== null;
      case 11:
        return answers.muscleGroups.length > 0;
      case 12:
        return answers.equipment.length > 0;
      case 13:
        return answers.notifications !== null;
      default:
        return true;
    }
  }, [step, answers]);

  const goNext = () => {
    if (step === TOTAL_QUESTION_STEPS) {
      router.push("/onboarding/summary" as any);
    } else {
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    if (step === 1) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  };

  // Age step: no ScrollView wrapper (avoids nested-VirtualizedList warning/crash
  // from WheelPicker's internal FlatList).
  const renderAgeStep = () => (
    <View style={styles.content}>
      <Text style={styles.question}>How old are you?</Text>
      <WheelPicker min={13} max={90} value={answers.age ?? 25} onChange={(v) => updateAnswer("age", v)} />
    </View>
  );

  const renderOtherSteps = () => (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {step === 1 && (
        <View>
          <Ionicons name="person-circle" size={72} color={colors.primary} style={styles.centerIcon} />
          <Text style={styles.question}>What's your name?</Text>
          <AnimatedInput
            placeholder="Enter your name"
            value={answers.name}
            onChangeText={(t) => updateAnswer("name", t)}
            autoCapitalize="words"
          />
          {answers.name.trim().length > 0 && (
            <Animated.Text entering={FadeIn.duration(300)} style={styles.greeting}>
              Nice to meet you, {answers.name.trim()} 👋
            </Animated.Text>
          )}
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={styles.question}>What's your gender?</Text>
          <View style={styles.cardGrid}>
            {GENDER_OPTIONS.map((opt) => (
              <QuestionCard
                key={opt.value}
                icon={opt.icon}
                label={opt.label}
                selected={answers.gender === opt.value}
                onPress={() => updateAnswer("gender", opt.value)}
                style={styles.cardThird}
              />
            ))}
          </View>
        </View>
      )}

      {step === 4 && (
        <View>
          <Text style={styles.question}>What's your height?</Text>
          <ChipSelector
            options={[{ value: "cm", label: "cm" }, { value: "ft", label: "ft" }]}
            selected={[answers.heightUnit]}
            onToggle={(v) => updateAnswer("heightUnit", v as any)}
          />
          <View style={{ height: spacing.md }} />
          <AnimatedInput
            placeholder={answers.heightUnit === "cm" ? "e.g. 175" : "e.g. 5.9"}
            keyboardType="decimal-pad"
            value={answers.height !== null ? String(answers.height) : ""}
            onChangeText={(t) => updateAnswer("height", t ? parseFloat(t) : null)}
          />
        </View>
      )}

      {step === 5 && (
        <View>
          <Text style={styles.question}>What's your weight?</Text>
          <ChipSelector
            options={[{ value: "kg", label: "kg" }, { value: "lbs", label: "lbs" }]}
            selected={[answers.weightUnit]}
            onToggle={(v) => updateAnswer("weightUnit", v as any)}
          />
          <View style={{ height: spacing.md }} />
          <AnimatedInput
            placeholder={answers.weightUnit === "kg" ? "e.g. 70" : "e.g. 154"}
            keyboardType="decimal-pad"
            value={answers.weight !== null ? String(answers.weight) : ""}
            onChangeText={(t) => updateAnswer("weight", t ? parseFloat(t) : null)}
          />
        </View>
      )}

      {step === 6 && (
        <View>
          <Text style={styles.question}>What's your fitness goal?</Text>
          <View style={styles.cardGrid}>
            {GOAL_OPTIONS.map((opt) => (
              <QuestionCard
                key={opt.value}
                icon={opt.icon}
                label={opt.label}
                selected={answers.goal === opt.value}
                onPress={() => updateAnswer("goal", opt.value)}
                style={styles.cardHalf}
              />
            ))}
          </View>
        </View>
      )}

      {step === 7 && (
        <View>
          <Text style={styles.question}>Your workout experience?</Text>
          <View style={styles.cardGrid}>
            {EXPERIENCE_OPTIONS.map((opt) => (
              <QuestionCard
                key={opt.value}
                icon={opt.icon}
                label={opt.label}
                selected={answers.experience === opt.value}
                onPress={() => updateAnswer("experience", opt.value)}
                style={styles.cardThird}
              />
            ))}
          </View>
        </View>
      )}

      {step === 8 && (
        <View>
          <Text style={styles.question}>Where do you train?</Text>
          <View style={styles.cardGrid}>
            {LOCATION_OPTIONS.map((opt) => (
              <QuestionCard
                key={opt.value}
                icon={opt.icon}
                label={opt.label}
                selected={answers.location === opt.value}
                onPress={() => updateAnswer("location", opt.value)}
                style={styles.cardThird}
              />
            ))}
          </View>
        </View>
      )}

      {step === 9 && (
        <View>
          <Text style={styles.question}>How many days a week?</Text>
          <ChipSelector
            options={WORKOUT_DAYS_OPTIONS.map((d) => ({ value: d, label: String(d) }))}
            selected={answers.workoutDays !== null ? [answers.workoutDays] : []}
            onToggle={(v) => updateAnswer("workoutDays", v as number)}
          />
        </View>
      )}

      {step === 10 && (
        <View>
          <Text style={styles.question}>Preferred workout time?</Text>
          <View style={styles.cardGrid}>
            {TIME_OPTIONS.map((opt) => (
              <QuestionCard
                key={opt.value}
                icon={opt.icon}
                label={opt.label}
                selected={answers.workoutTime === opt.value}
                onPress={() => updateAnswer("workoutTime", opt.value)}
                style={styles.cardHalf}
              />
            ))}
          </View>
        </View>
      )}

      {step === 11 && (
        <View>
          <Text style={styles.question}>Target muscle groups?</Text>
          <Text style={styles.hint}>Select all that apply</Text>
          <ChipSelector
            options={MUSCLE_OPTIONS.map((m) => ({ value: m.value, label: m.label }))}
            selected={answers.muscleGroups}
            onToggle={(v) => toggleArrayValue("muscleGroups", v as any)}
          />
        </View>
      )}

      {step === 12 && (
        <View>
          <Text style={styles.question}>Equipment available?</Text>
          <Text style={styles.hint}>Select all that apply</Text>
          <ChipSelector
            options={EQUIPMENT_OPTIONS.map((e) => ({ value: e.value, label: e.label }))}
            selected={answers.equipment}
            onToggle={(v) => toggleArrayValue("equipment", v as any)}
          />
        </View>
      )}

      {step === 13 && (
        <View>
          <Text style={styles.question}>Allow workout reminders?</Text>
          <View style={styles.cardGrid}>
            <QuestionCard
              icon="notifications"
              label="Yes, remind me"
              selected={answers.notifications === "yes"}
              onPress={() => updateAnswer("notifications", "yes")}
              style={styles.cardHalf}
            />
            <QuestionCard
              icon="time"
              label="Maybe later"
              selected={answers.notifications === "later"}
              onPress={() => updateAnswer("notifications", "later")}
              style={styles.cardHalf}
            />
          </View>
        </View>
      )}
    </ScrollView>
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <ProgressHeader step={step} total={TOTAL_QUESTION_STEPS} onBack={goBack} />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Animated.View
            key={step}
            entering={SlideInRight.duration(250)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.flex}
          >
            {step === 3 ? renderAgeStep() : renderOtherSteps()}
          </Animated.View>
        </KeyboardAvoidingView>

        <View style={styles.controls}>
          <SecondaryButton label="Back" onPress={goBack} style={styles.controlButton} />
          <PrimaryButton
            label={step === TOTAL_QUESTION_STEPS ? "Review" : "Next"}
            onPress={goNext}
            disabled={!isValid}
            style={styles.controlButton}
          />
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  centerIcon: {
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  question: {
    ...typography.title,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  hint: {
    ...typography.caption,
    textAlign: "center",
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
  greeting: {
    ...typography.body,
    color: colors.primary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
  },
  cardHalf: {
    width: "47%",
  },
  cardThird: {
    width: "30%",
  },
  controls: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  controlButton: {
    flex: 1,
  },
});