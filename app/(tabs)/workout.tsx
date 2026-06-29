/**
 * WorkoutScreen.tsx — Fully Responsive UI (white background, black text)
 *
 * ✓ All business logic, Firestore, Cloudinary, timers, routines preserved
 * ✓ Responsive typography, spacing, and touch targets
 * ✓ Tablet, landscape, foldable support
 * ✓ Accessibility: dynamic font sizes, high contrast
 * ✓ Performance: FlatList, memo, useCallback maintained
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  ActivityIndicator,
  FlatList,
  useWindowDimensions,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { auth, db } from '../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────
// Responsive Utilities
// ─────────────────────────────────────────────

/**
 * ResponsiveScale: Calculates responsive values based on screen width
 * - Small phones (320px): base scale
 * - Medium phones (375px): +5% scale
 * - Large phones (430px): +8% scale
 * - Tablets (768px+): max scale with content centering
 */
const createResponsiveScale = (screenWidth: number, screenHeight: number) => {
  const isTablet = screenWidth >= 768;
  const isLandscape = screenWidth > screenHeight;
  const baseWidth = 375; // Reference width (iPhone 8)

  // Scale factor: 1.0 at 375px, increases smoothly for larger screens
  const scaleFactor = Math.min(screenWidth / baseWidth, isTablet ? 1.2 : 1.15);

  // Responsive scale function with min/max bounds
  const scale = (baseValue: number, minValue?: number, maxValue?: number) => {
    let result = baseValue * scaleFactor;
    if (minValue !== undefined) result = Math.max(result, minValue);
    if (maxValue !== undefined) result = Math.min(result, maxValue);
    return result;
  };

  // Typography scale (with accessibility consideration)
  const fontSize = {
    xs: scale(11, 10, 14),      // Labels, hints
    sm: scale(13, 12, 15),      // Secondary text
    base: scale(15, 14, 16),    // Body text
    lg: scale(17, 16, 18),      // Emphasis
    xl: scale(20, 19, 22),      // Section headers
    xxl: scale(28, 26, 32),     // Screen titles
    xxxl: scale(32, 30, 38),    // Timer displays
  };

  // Spacing scale
  const spacing = {
    xs: scale(4, 3, 6),
    sm: scale(8, 6, 10),
    md: scale(12, 10, 14),
    lg: scale(16, 14, 18),
    xl: scale(20, 18, 22),
    xxl: scale(24, 22, 28),
  };

  // Touch target minimum (accessibility: 44x44 at least)
  const touchTarget = Math.max(scale(44, 44, 56), 44);

  // Max content width for tablets (prevents extreme stretching)
  const maxContentWidth = isTablet ? Math.min(screenWidth * 0.85, 900) : screenWidth;

  // Content padding for different screen sizes
  const contentHPadding = isTablet
    ? (screenWidth - maxContentWidth) / 2
    : spacing.lg;

  return {
    screen: { width: screenWidth, height: screenHeight, isTablet, isLandscape },
    scale,
    fontSize,
    spacing,
    touchTarget,
    maxContentWidth,
    contentHPadding,
  };
};

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface SetEntry {
  id: string;
  weight: string;
  reps: string;
  done: boolean;
}

interface ExerciseLibItem {
  id: string;
  name: string;
  muscle: string;
  thumbnail: string;
  video: string;
  description: string;
  equipment: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  primaryMuscles: string[];
  secondaryMuscles: string[];
  icon: string;
}

interface ExerciseEntry {
  id: string;
  libId: string;
  name: string;
  muscle: string;
  sets: SetEntry[];
}

interface Routine {
  id: string;
  title: string;
  exercises: ExerciseEntry[];
}

// ─────────────────────────────────────────────
// Cloudinary
// ─────────────────────────────────────────────
const CDN = 'https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload';
const CDN_VIDEO = 'https://res.cloudinary.com/YOUR_CLOUD_NAME/video/upload';

const img = (path: string) => `${CDN}/q_auto,f_auto,w_600/${path}`;
const vid = (path: string) => `${CDN_VIDEO}/q_auto/${path}`;

// ─────────────────────────────────────────────
// Exercise Library
// ─────────────────────────────────────────────
const EXERCISE_LIBRARY: ExerciseLibItem[] = [
  {
    id: 'bench_press_barbell',
    name: 'Bench Press (Barbell)',
    muscle: 'Chest',
    thumbnail: img('GymTracker/Exercises/Chest/bench_press.jpg'),
    video: vid('GymTracker/Exercises/Chest/bench_press.mp4'),
    description:
      'A compound chest exercise that builds strength and upper body mass. Lie on a flat bench, grip the bar just outside shoulder-width, lower it to your mid-chest, then press explosively back to full extension.',
    equipment: 'Barbell',
    difficulty: 'Intermediate',
    primaryMuscles: ['Chest'],
    secondaryMuscles: ['Triceps', 'Front Shoulders'],
    icon: '🏋️',
  },
  {
    id: 'bench_press_dumbbell',
    name: 'Bench Press (Dumbbell)',
    muscle: 'Chest',
    thumbnail: img('GymTracker/Exercises/Chest/bench_press_db.jpg'),
    video: vid('GymTracker/Exercises/Chest/bench_press_db.mp4'),
    description:
      'Greater range of motion than the barbell variation. Allows each arm to move independently, reducing muscular imbalances.',
    equipment: 'Dumbbells',
    difficulty: 'Beginner',
    primaryMuscles: ['Chest'],
    secondaryMuscles: ['Triceps', 'Front Shoulders'],
    icon: '🏋️',
  },
  {
    id: 'incline_press_dumbbell',
    name: 'Incline Press (Dumbbell)',
    muscle: 'Chest',
    thumbnail: img('GymTracker/Exercises/Chest/incline_press.jpg'),
    video: vid('GymTracker/Exercises/Chest/incline_press.mp4'),
    description:
      'Targets the upper chest and front deltoids. Set bench to 30–45 degrees for optimal activation.',
    equipment: 'Dumbbells',
    difficulty: 'Intermediate',
    primaryMuscles: ['Upper Chest'],
    secondaryMuscles: ['Triceps', 'Front Shoulders'],
    icon: '🏋️',
  },
  {
    id: 'squat_barbell',
    name: 'Squat (Barbell)',
    muscle: 'Legs',
    thumbnail: img('GymTracker/Exercises/Legs/squat.jpg'),
    video: vid('GymTracker/Exercises/Legs/squat.mp4'),
    description:
      'The king of lower-body exercises. Bar rests on upper traps; feet shoulder-width apart. Descend until thighs are parallel or below, then drive through heels to stand.',
    equipment: 'Barbell',
    difficulty: 'Intermediate',
    primaryMuscles: ['Quads', 'Glutes'],
    secondaryMuscles: ['Hamstrings', 'Core', 'Calves'],
    icon: '🦵',
  },
  {
    id: 'goblet_squat',
    name: 'Goblet Squat',
    muscle: 'Legs',
    thumbnail: img('GymTracker/Exercises/Legs/goblet_squat.jpg'),
    video: vid('GymTracker/Exercises/Legs/goblet_squat.mp4'),
    description:
      'Beginner-friendly squat variation. Hold a dumbbell or kettlebell at chest height and squat deep while keeping your torso upright.',
    equipment: 'Dumbbell',
    difficulty: 'Beginner',
    primaryMuscles: ['Quads', 'Glutes'],
    secondaryMuscles: ['Core'],
    icon: '🦵',
  },
  {
    id: 'romanian_deadlift',
    name: 'Romanian Deadlift',
    muscle: 'Legs',
    thumbnail: img('GymTracker/Exercises/Legs/rdl.jpg'),
    video: vid('GymTracker/Exercises/Legs/rdl.mp4'),
    description:
      'Excellent posterior-chain builder. Hinge at the hips with a slight knee bend, keeping the bar close to your legs as you lower it to mid-shin.',
    equipment: 'Barbell',
    difficulty: 'Intermediate',
    primaryMuscles: ['Hamstrings', 'Glutes'],
    secondaryMuscles: ['Lower Back', 'Calves'],
    icon: '🦵',
  },
  {
    id: 'deadlift_barbell',
    name: 'Deadlift (Barbell)',
    muscle: 'Legs',
    thumbnail: img('GymTracker/Exercises/Legs/deadlift.jpg'),
    video: vid('GymTracker/Exercises/Legs/deadlift.mp4'),
    description:
      'Full-body strength movement. Drive your feet into the floor and pull the bar to hip height, keeping a neutral spine throughout.',
    equipment: 'Barbell',
    difficulty: 'Advanced',
    primaryMuscles: ['Hamstrings', 'Glutes', 'Lower Back'],
    secondaryMuscles: ['Quads', 'Traps', 'Core'],
    icon: '🦵',
  },
  {
    id: 'leg_press',
    name: 'Leg Press',
    muscle: 'Legs',
    thumbnail: img('GymTracker/Exercises/Legs/leg_press.jpg'),
    video: vid('GymTracker/Exercises/Legs/leg_press.mp4'),
    description:
      'Machine-based lower-body press. Safer for those with back issues. Foot placement determines which muscles are emphasised.',
    equipment: 'Machine',
    difficulty: 'Beginner',
    primaryMuscles: ['Quads'],
    secondaryMuscles: ['Glutes', 'Hamstrings'],
    icon: '🦵',
  },
  {
    id: 'hip_thrust',
    name: 'Hip Thrust',
    muscle: 'Glutes',
    thumbnail: img('GymTracker/Exercises/Glutes/hip_thrust.jpg'),
    video: vid('GymTracker/Exercises/Glutes/hip_thrust.mp4'),
    description:
      'Best glute isolation exercise. Rest your upper back on a bench, drive a barbell or dumbbell over your hips, and squeeze your glutes at the top.',
    equipment: 'Barbell',
    difficulty: 'Intermediate',
    primaryMuscles: ['Glutes'],
    secondaryMuscles: ['Hamstrings', 'Core'],
    icon: '🍑',
  },
  {
    id: 'pull_up',
    name: 'Pull Up',
    muscle: 'Back',
    thumbnail: img('GymTracker/Exercises/Back/pull_up.jpg'),
    video: vid('GymTracker/Exercises/Back/pull_up.mp4'),
    description:
      'Bodyweight vertical pull. Start from a dead hang, drive elbows down and back to pull your chin above the bar.',
    equipment: 'Pull-up Bar',
    difficulty: 'Intermediate',
    primaryMuscles: ['Lats'],
    secondaryMuscles: ['Biceps', 'Rear Shoulders', 'Core'],
    icon: '🔝',
  },
  {
    id: 'lat_pulldown',
    name: 'Lat Pulldown',
    muscle: 'Back',
    thumbnail: img('GymTracker/Exercises/Back/lat_pulldown.jpg'),
    video: vid('GymTracker/Exercises/Back/lat_pulldown.mp4'),
    description:
      'Cable machine lat exercise. Pull the bar to your upper chest while keeping your torso slightly reclined.',
    equipment: 'Cable Machine',
    difficulty: 'Beginner',
    primaryMuscles: ['Lats'],
    secondaryMuscles: ['Biceps', 'Rear Shoulders'],
    icon: '🔝',
  },
  {
    id: 'seated_row',
    name: 'Seated Row',
    muscle: 'Back',
    thumbnail: img('GymTracker/Exercises/Rows/row.jpg'),
    video: vid('GymTracker/Exercises/Rows/row.mp4'),
    description:
      'Horizontal pull that targets mid-back thickness. Sit upright and pull the handle to your lower sternum, squeezing the shoulder blades together.',
    equipment: 'Cable Machine',
    difficulty: 'Beginner',
    primaryMuscles: ['Mid Back', 'Rhomboids'],
    secondaryMuscles: ['Biceps', 'Rear Shoulders'],
    icon: '🔝',
  },
  {
    id: 'overhead_press',
    name: 'Overhead Press',
    muscle: 'Shoulders',
    thumbnail: img('GymTracker/Exercises/Shoulders/ohp.jpg'),
    video: vid('GymTracker/Exercises/Shoulders/ohp.mp4'),
    description:
      'Strict vertical press for shoulder strength and size. Keep core tight and press the bar from clavicle to full lockout overhead.',
    equipment: 'Barbell',
    difficulty: 'Intermediate',
    primaryMuscles: ['Front Shoulders', 'Lateral Shoulders'],
    secondaryMuscles: ['Triceps', 'Upper Chest', 'Core'],
    icon: '💪',
  },
  {
    id: 'lateral_raise',
    name: 'Lateral Raise',
    muscle: 'Shoulders',
    thumbnail: img('GymTracker/Exercises/Shoulders/lateral_raise.jpg'),
    video: vid('GymTracker/Exercises/Shoulders/lateral_raise.mp4'),
    description:
      'Isolation exercise for the medial deltoid. Raise dumbbells out to the sides to shoulder height with a slight forward lean.',
    equipment: 'Dumbbells',
    difficulty: 'Beginner',
    primaryMuscles: ['Lateral Shoulders'],
    secondaryMuscles: ['Front Shoulders', 'Traps'],
    icon: '💪',
  },
  {
    id: 'triceps_pushdown',
    name: 'Triceps Pushdown',
    muscle: 'Arms',
    thumbnail: img('GymTracker/Exercises/Arms/triceps_pushdown.jpg'),
    video: vid('GymTracker/Exercises/Arms/triceps_pushdown.mp4'),
    description:
      'Cable isolation for the triceps. Keep elbows pinned to your sides and extend fully at the bottom.',
    equipment: 'Cable Machine',
    difficulty: 'Beginner',
    primaryMuscles: ['Triceps'],
    secondaryMuscles: [],
    icon: '💪',
  },
  {
    id: 'bicep_curl_dumbbell',
    name: 'Bicep Curl (Dumbbell)',
    muscle: 'Arms',
    thumbnail: img('GymTracker/Exercises/Arms/bicep_curl.jpg'),
    video: vid('GymTracker/Exercises/Arms/bicep_curl.mp4'),
    description:
      'Classic bicep isolation. Supinate your wrist at the top and squeeze hard before lowering under control.',
    equipment: 'Dumbbells',
    difficulty: 'Beginner',
    primaryMuscles: ['Biceps'],
    secondaryMuscles: ['Forearms'],
    icon: '💪',
  },
  {
    id: 'hanging_leg_raise',
    name: 'Hanging Leg Raise',
    muscle: 'Core',
    thumbnail: img('GymTracker/Exercises/Core/hanging_leg_raise.jpg'),
    video: vid('GymTracker/Exercises/Core/hanging_leg_raise.mp4'),
    description:
      'Advanced core exercise. Hang from a bar and raise legs to 90 degrees (or higher for advanced). Avoid swinging.',
    equipment: 'Pull-up Bar',
    difficulty: 'Advanced',
    primaryMuscles: ['Lower Abs'],
    secondaryMuscles: ['Hip Flexors', 'Core'],
    icon: '🧘',
  },
  {
    id: 'plank',
    name: 'Plank',
    muscle: 'Core',
    thumbnail: img('GymTracker/Exercises/Core/plank.jpg'),
    video: vid('GymTracker/Exercises/Core/plank.mp4'),
    description:
      'Isometric core hold. Maintain a straight line from head to heels, bracing abs and glutes for the entire duration.',
    equipment: 'Bodyweight',
    difficulty: 'Beginner',
    primaryMuscles: ['Core', 'Transverse Abs'],
    secondaryMuscles: ['Shoulders', 'Glutes'],
    icon: '🧘',
  },
  {
    id: 'seated_calf_raise',
    name: 'Seated Calf Raise',
    muscle: 'Legs',
    thumbnail: img('GymTracker/Exercises/Legs/calf_raise.jpg'),
    video: vid('GymTracker/Exercises/Legs/calf_raise.mp4'),
    description:
      'Targets the soleus (inner calf). Seated position bends the knee and de-emphasises the gastrocnemius.',
    equipment: 'Machine',
    difficulty: 'Beginner',
    primaryMuscles: ['Soleus'],
    secondaryMuscles: ['Gastrocnemius'],
    icon: '🦵',
  },
];

const MUSCLE_FILTERS = [
  'All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Glutes',
];

const muscleColors: Record<string, { bg: string; text: string }> = {
  Chest:     { bg: '#FEF3C7', text: '#92400E' },
  Arms:      { bg: '#EDE9FE', text: '#5B21B6' },
  Back:      { bg: '#E0E7FF', text: '#3730A3' },
  Core:      { bg: '#ECFDF5', text: '#065F46' },
  Legs:      { bg: '#EFF6FF', text: '#1E40AF' },
  Glutes:    { bg: '#FFF7ED', text: '#9A3412' },
  Shoulders: { bg: '#FEF2F2', text: '#991B1B' },
};

const difficultyColors: Record<string, { bg: string; text: string }> = {
  Beginner:     { bg: '#DCFCE7', text: '#166534' },
  Intermediate: { bg: '#FEF3C7', text: '#92400E' },
  Advanced:     { bg: '#FEE2E2', text: '#991B1B' },
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const getLibItem = (libId: string): ExerciseLibItem | undefined =>
  EXERCISE_LIBRARY.find(e => e.id === libId);

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

/** Animated skeleton shimmer for thumbnail placeholders */
const SkeletonBox = memo(({ style }: { style: any }) => {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });
  return <Animated.View style={[style, { opacity, backgroundColor: '#E5E5EA' }]} />;
});

/** Lazy-load image with skeleton */
const LazyImage = memo(
  ({ uri, style }: { uri: string; style: any }) => {
    const [loaded, setLoaded] = useState(false);
    return (
      <View style={[style, { overflow: 'hidden' }]}>
        {!loaded && <SkeletonBox style={StyleSheet.absoluteFill} />}
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { opacity: loaded ? 1 : 0 }]}
          onLoad={() => setLoaded(true)}
          resizeMode="cover"
        />
      </View>
    );
  }
);

// ─────────────────────────────────────────────
// Routine Card (responsive)
// ─────────────────────────────────────────────
interface RoutineCardProps {
  routine: Routine;
  onStart: (routine: Routine) => void;
  onMenu: (routine: Routine) => void;
  r: ReturnType<typeof createResponsiveScale>;
}

const RoutineCard = memo(({ routine, onStart, onMenu, r }: RoutineCardProps) => {
  const exerciseNames = routine.exercises.map(e => e.name).join(', ');
  const styles = getRoutineCardStyles(r);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={1}>{routine.title}</Text>
        <TouchableOpacity
          onPress={() => onMenu(routine)}
          hitSlop={{ top: r.touchTarget / 2, bottom: r.touchTarget / 2, left: r.touchTarget / 2, right: r.touchTarget / 2 }}
          accessibilityRole="button"
          accessibilityLabel={`Menu for ${routine.title}`}
        >
          <Ionicons name="ellipsis-horizontal" size={r.scale(20, 18, 24)} color="#8E8E93" />
        </TouchableOpacity>
      </View>
      {exerciseNames.length > 0 && (
        <Text style={styles.cardExercises} numberOfLines={2}>
          {exerciseNames}
        </Text>
      )}
      <TouchableOpacity
        style={styles.startBtn}
        onPress={() => onStart(routine)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Start ${routine.title}`}
      >
        <Text style={styles.startBtnText}>Start Routine</Text>
      </TouchableOpacity>
    </View>
  );
});

// ─────────────────────────────────────────────
// Routine List (collapsible, responsive)
// ─────────────────────────────────────────────
interface RoutineListProps {
  routines: Routine[];
  onStart: (routine: Routine) => void;
  onMenu: (routine: Routine) => void;
  r: ReturnType<typeof createResponsiveScale>;
}

const RoutineList = memo(({ routines, onStart, onMenu, r }: RoutineListProps) => {
  const [expanded, setExpanded] = useState(true);
  const rotateAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const styles = getRoutineListStyles(r);

  const toggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    Animated.timing(rotateAnim, {
      toValue: next ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [expanded]);

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <View>
      <TouchableOpacity
        style={styles.header}
        onPress={toggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Routines, ${routines.length} saved`}
        accessibilityState={{ expanded }}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="chevron-forward" size={r.scale(16, 14, 20)} color="#8E8E93" />
        </Animated.View>
        <Text style={styles.headerText}>
          My Routines ({routines.length})
        </Text>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.cardGrid}>
          {routines.map(routine => (
            <View key={routine.id} style={styles.cardWrapper}>
              <RoutineCard routine={routine} onStart={onStart} onMenu={onMenu} r={r} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

// ─────────────────────────────────────────────
// Create Routine Screen (modal, responsive)
// ─────────────────────────────────────────────
interface CreateRoutineScreenProps {
  visible: boolean;
  onCancel: () => void;
  onSave: (routine: Routine) => void;
  pickerVisible: boolean;
  setPickerVisible: (v: boolean) => void;
  search: string;
  setSearch: (v: string) => void;
  muscleFilter: string;
  setMuscleFilter: (v: string) => void;
  filteredLibrary: ExerciseLibItem[];
  r: ReturnType<typeof createResponsiveScale>;
}

const CreateRoutineScreen = memo((props: CreateRoutineScreenProps) => {
  const {
    visible, onCancel, onSave,
    pickerVisible, setPickerVisible,
    search, setSearch,
    muscleFilter, setMuscleFilter,
    filteredLibrary, r,
  } = props;

  const [title, setTitle] = useState('');
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const styles = getCreateRoutineStyles(r);

  const handleSave = useCallback(() => {
    if (!title.trim()) return;
    onSave({ id: uid(), title: title.trim(), exercises });
    setTitle('');
    setExercises([]);
  }, [title, exercises, onSave]);

  const addExercise = useCallback((lib: ExerciseLibItem) => {
    setExercises(prev => [
      ...prev,
      {
        id: uid(),
        libId: lib.id,
        name: lib.name,
        muscle: lib.muscle,
        sets: [{ id: uid(), weight: '', reps: '', done: false }],
      },
    ]);
    setPickerVisible(false);
    setSearch('');
    setMuscleFilter('All');
  }, []);

  const removeExercise = useCallback((exId: string) => {
    setExercises(prev => prev.filter(e => e.id !== exId));
  }, []);

  const hasTitle = title.trim().length > 0;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <SafeAreaView style={styles.safe}>
        {/* Nav */}
        <View style={styles.nav}>
          <TouchableOpacity onPress={onCancel} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>Create Routine</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!hasTitle}
            activeOpacity={0.7}
            style={[styles.saveBtn, !hasTitle && styles.saveBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={hasTitle ? 'Save routine' : 'Save routine (disabled)'}
            accessibilityState={{ disabled: !hasTitle }}
          >
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: r.spacing.xxl }}
        >
          {/* Title input */}
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Routine title"
            placeholderTextColor="#C7C7CC"
            accessibilityLabel="Routine name"
            maxLength={50}
          />
          <View style={styles.titleDivider} />

          {exercises.length === 0 ? (
            /* Empty state */
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏋</Text>
              <Text style={styles.emptyText}>
                Get started by adding an exercise to your routine.
              </Text>
            </View>
          ) : (
            /* Exercise list */
            <View style={{ paddingHorizontal: r.contentHPadding, paddingTop: r.spacing.lg }}>
              {exercises.map(ex => {
                const lib = getLibItem(ex.libId);
                return (
                  <View key={ex.id} style={styles.exCard}>
                    <View style={styles.exCardHeader}>
                      {lib && (
                        <LazyImage uri={lib.thumbnail} style={styles.exThumb} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.exName} numberOfLines={1}>{ex.name}</Text>
                        <Text style={styles.exMuscle}>{ex.muscle}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeExercise(ex.id)}
                        hitSlop={{ top: r.touchTarget / 2, bottom: r.touchTarget / 2, left: r.touchTarget / 2, right: r.touchTarget / 2 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${ex.name}`}
                      >
                        <Ionicons name="trash-outline" size={r.scale(18, 16, 22)} color="#C7C7CC" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.exSetRow}>
                      <Text style={styles.exSetLabel}>SET</Text>
                      <Text style={styles.exSetLabel}>KG</Text>
                      <Text style={styles.exSetLabel}>REPS</Text>
                    </View>
                    {ex.sets.map((set, idx) => (
                      <View key={set.id} style={styles.exSetDataRow}>
                        <Text style={styles.exSetNum}>{idx + 1}</Text>
                        <Text style={styles.exSetVal}>{set.weight || '—'}</Text>
                        <Text style={styles.exSetVal}>{set.reps || '—'}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          )}

          {/* Add Exercise button */}
          <TouchableOpacity
            style={styles.addExBtn}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add exercise"
          >
            <Text style={styles.addExBtnText}>+ Add exercise</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Exercise Picker Modal */}
        <ExercisePickerModal
          visible={pickerVisible}
          onClose={() => {
            setPickerVisible(false);
            setSearch('');
            setMuscleFilter('All');
          }}
          search={search}
          setSearch={setSearch}
          muscleFilter={muscleFilter}
          setMuscleFilter={setMuscleFilter}
          filteredLibrary={filteredLibrary}
          onSelectExercise={addExercise}
          r={r}
        />
      </SafeAreaView>
    </Modal>
  );
});

// ─────────────────────────────────────────────
// Exercise Picker Modal (shared, responsive)
// ─────────────────────────────────────────────
interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  search: string;
  setSearch: (v: string) => void;
  muscleFilter: string;
  setMuscleFilter: (v: string) => void;
  filteredLibrary: ExerciseLibItem[];
  onSelectExercise: (lib: ExerciseLibItem) => void;
  r: ReturnType<typeof createResponsiveScale>;
}

const ExercisePickerModal = memo(
  ({
    visible,
    onClose,
    search,
    setSearch,
    muscleFilter,
    setMuscleFilter,
    filteredLibrary,
    onSelectExercise,
    r,
  }: ExercisePickerModalProps) => {
    const styles = getExercisePickerStyles(r);

    return (
      <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>Add Exercise</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: r.touchTarget / 2, bottom: r.touchTarget / 2, left: r.touchTarget / 2, right: r.touchTarget / 2 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <View style={styles.closeBtn}>
                  <Ionicons name="close" size={r.scale(18, 16, 22)} color="#8E8E93" />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={r.scale(16, 14, 20)} color="#8E8E93" />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Name, muscle, equipment, difficulty…"
                placeholderTextColor="#C7C7CC"
                accessibilityLabel="Search exercises"
              />
              {search.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearch('')}
                  hitSlop={{ top: r.touchTarget / 2, bottom: r.touchTarget / 2, left: r.touchTarget / 2, right: r.touchTarget / 2 }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={r.scale(16, 14, 20)} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterRow}
              contentContainerStyle={{ paddingHorizontal: r.contentHPadding, gap: r.spacing.sm }}
            >
              {MUSCLE_FILTERS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, muscleFilter === f && styles.filterChipActive]}
                  onPress={() => setMuscleFilter(f)}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${f}`}
                  accessibilityState={{ selected: muscleFilter === f }}
                >
                  <Text style={[styles.filterChipText, muscleFilter === f && styles.filterChipTextActive]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <FlatList
              data={filteredLibrary}
              keyExtractor={item => item.id}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              scrollIndicatorInsets={{ right: 1 }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingTop: r.spacing.xxl * 2 }}>
                  <Text style={{ fontSize: r.fontSize.xxl, marginBottom: r.spacing.lg }}>🔍</Text>
                  <Text style={{ color: '#8E8E93', fontSize: r.fontSize.sm }}>No exercises found</Text>
                </View>
              }
              ListFooterComponent={<View style={{ height: r.spacing.lg }} />}
              renderItem={({ item }) => {
                const colors = muscleColors[item.muscle] ?? { bg: '#F2F2F7', text: '#8E8E93' };
                const diff = difficultyColors[item.difficulty] ?? { bg: '#F2F2F7', text: '#8E8E93' };
                return (
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => onSelectExercise(item)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item.name}`}
                  >
                    <LazyImage uri={item.thumbnail} style={styles.rowThumb} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.rowBadges}>
                        <View style={[styles.chip, { backgroundColor: colors.bg }]}>
                          <Text style={[styles.chipText, { color: colors.text }]}>
                            {item.muscle}
                          </Text>
                        </View>
                        <View style={[styles.chip, { backgroundColor: diff.bg }]}>
                          <Text style={[styles.chipText, { color: diff.text }]}>
                            {item.difficulty}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.equipRow}>
                        <Ionicons
                          name="barbell-outline"
                          size={r.scale(11, 10, 14)}
                          color="#8E8E93"
                          style={{ marginRight: r.spacing.xs }}
                        />
                        <Text style={styles.equipText}>{item.equipment}</Text>
                      </View>
                    </View>
                    <View style={styles.addBtn}>
                      <Ionicons name="add" size={r.scale(18, 16, 22)} color="#007AFF" />
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }
);

// ─────────────────────────────────────────────
// Video Detail Modal (responsive)
// ─────────────────────────────────────────────
interface VideoModalProps {
  item: ExerciseLibItem | null;
  visible: boolean;
  onClose: () => void;
  r: ReturnType<typeof createResponsiveScale>;
}

const VideoModal = memo(({ item, visible, onClose, r }: VideoModalProps) => {
  const player = useVideoPlayer(item?.video ?? '', p => {
    p.loop = false;
  });
  const styles = getVideoModalStyles(r);

  useEffect(() => {
    if (!visible) {
      player.pause();
    }
  }, [visible]);

  if (!item) return null;

  const muscleBg = muscleColors[item.muscle] ?? { bg: '#F2F2F7', text: '#8E8E93' };
  const diffBg = difficultyColors[item.difficulty] ?? { bg: '#F2F2F7', text: '#8E8E93' };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close video"
        />
        <View style={styles.sheet}>
          <View style={styles.videoWrap}>
            <VideoView
              player={player}
              style={styles.video}
              allowsFullscreen
              allowsPictureInPicture
              contentFit="cover"
            />
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={r.scale(20, 18, 24)} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.infoScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: r.spacing.xxl * 2 }}
          >
            <Text style={styles.title}>{item.name}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: muscleBg.bg }]}>
                <Text style={[styles.badgeText, { color: muscleBg.text }]}>
                  {item.muscle}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: diffBg.bg }]}>
                <Text style={[styles.badgeText, { color: diffBg.text }]}>
                  {item.difficulty}
                </Text>
              </View>
              <View style={styles.equipBadge}>
                <Ionicons
                  name="barbell-outline"
                  size={r.scale(12, 10, 14)}
                  color="#8E8E93"
                  style={{ marginRight: r.spacing.xs }}
                />
                <Text style={styles.equipText}>{item.equipment}</Text>
              </View>
            </View>
            <Text style={styles.sectionLabel}>About</Text>
            <Text style={styles.description}>{item.description}</Text>
            {item.primaryMuscles.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Primary Muscles</Text>
                <View style={styles.muscleTagRow}>
                  {item.primaryMuscles.map(m => (
                    <View key={m} style={styles.muscleTag}>
                      <Text style={styles.muscleTagText}>{m}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            {item.secondaryMuscles.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Secondary Muscles</Text>
                <View style={styles.muscleTagRow}>
                  {item.secondaryMuscles.map(m => (
                    <View key={m} style={[styles.muscleTag, styles.muscleTagSecondary]}>
                      <Text style={[styles.muscleTagText, { color: '#8E8E93' }]}>{m}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────
export default function WorkoutScreen() {
  const { width, height } = useWindowDimensions();
  const r = createResponsiveScale(width, height);
  const styles = getMainStyles(r);

  // ── Workout state ──
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Picker state (shared between active workout and create routine) ──
  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('All');

  // ── Video modal state ──
  const [videoItem, setVideoItem] = useState<ExerciseLibItem | null>(null);
  const [videoVisible, setVideoVisible] = useState(false);

  // ── Rest timer state ──
  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const REST_DURATION = 90;

  // ── Routines state ──
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [createRoutineVisible, setCreateRoutineVisible] = useState(false);
  const [routinePickerVisible, setRoutinePickerVisible] = useState(false);
  const [routineSearch, setRoutineSearch] = useState('');
  const [routineMuscleFilter, setRoutineMuscleFilter] = useState('All');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Workout timer ──
  useEffect(() => {
    if (exercises.length > 0 && !running) setRunning(true);
  }, [exercises.length]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  // ── Rest timer ──
  useEffect(() => {
    if (restRunning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
      restIntervalRef.current = setInterval(() => {
        setRestSeconds(s => {
          if (s >= REST_DURATION) { setRestRunning(false); return 0; }
          return s + 1;
        });
      }, 1000);
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    }
    return () => { if (restIntervalRef.current) clearInterval(restIntervalRef.current); };
  }, [restRunning]);

  // ── Helpers ──
  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '00')}:${String(sec).padStart(2, '0')}`;
  };

  const totalVolume = exercises.reduce(
    (sum, ex) =>
      sum +
      ex.sets.reduce((s, set) => {
        const w = parseFloat(set.weight) || 0;
        const r_val = parseFloat(set.reps) || 0;
        return s + (set.done ? w * r_val : 0);
      }, 0),
    0
  );
  const totalSetsDone = exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(s => s.done).length,
    0
  );

  // ── Workout actions ──
  const addExercise = useCallback((lib: ExerciseLibItem) => {
    setExercises(prev => [
      ...prev,
      {
        id: uid(),
        libId: lib.id,
        name: lib.name,
        muscle: lib.muscle,
        sets: [{ id: uid(), weight: '', reps: '', done: false }],
      },
    ]);
    setPickerVisible(false);
    setSearch('');
    setMuscleFilter('All');
  }, []);

  const addSet = useCallback((exId: string) => {
    setExercises(prev =>
      prev.map(ex => {
        if (ex.id !== exId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            { id: uid(), weight: last?.weight || '', reps: last?.reps || '', done: false },
          ],
        };
      })
    );
  }, []);

  const updateSet = useCallback(
    (exId: string, setId: string, field: 'weight' | 'reps', value: string) => {
      setExercises(prev =>
        prev.map(ex =>
          ex.id !== exId
            ? ex
            : { ...ex, sets: ex.sets.map(s => (s.id === setId ? { ...s, [field]: value } : s)) }
        )
      );
    },
    []
  );

  const toggleSetDone = useCallback((exId: string, setId: string) => {
    setExercises(prev =>
      prev.map(ex =>
        ex.id !== exId
          ? ex
          : { ...ex, sets: ex.sets.map(s => (s.id === setId ? { ...s, done: !s.done } : s)) }
      )
    );
    setRestSeconds(0);
    setRestRunning(true);
  }, []);

  const removeSet = useCallback((exId: string, setId: string) => {
    setExercises(prev =>
      prev.map(ex =>
        ex.id !== exId ? ex : { ...ex, sets: ex.sets.filter(s => s.id !== setId) }
      )
    );
  }, []);

  const removeExercise = useCallback((exId: string) => {
    Alert.alert('Remove exercise?', 'All sets for this exercise will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setExercises(prev => prev.filter(ex => ex.id !== exId)),
      },
    ]);
  }, []);

  const handleDiscard = useCallback(() => {
    if (exercises.length === 0) return;
    Alert.alert('Discard Workout', 'This will erase your current progress.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          setExercises([]);
          setSeconds(0);
          setRunning(false);
          setRestRunning(false);
        },
      },
    ]);
  }, [exercises.length]);

  const handleFinish = useCallback(async () => {
    if (exercises.length === 0) {
      Alert.alert('Nothing to save', 'Add at least one exercise first.');
      return;
    }
    const user = auth.currentUser;
    if (!user) { Alert.alert('Not signed in'); return; }
    try {
      setSaving(true);
      setRunning(false);
      setRestRunning(false);

      const cleanExercises = exercises
        .map(ex => ({
          name: ex.name,
          muscle: ex.muscle,
          sets: ex.sets
            .filter(s => s.done)
            .map(s => ({ weight: s.weight, reps: s.reps })),
        }))
        .filter(ex => ex.sets.length > 0);

      if (cleanExercises.length === 0) {
        Alert.alert('No completed sets', 'Mark at least one set as done before finishing.');
        setSaving(false);
        setRunning(true);
        return;
      }

      await addDoc(collection(db, 'workouts'), {
        userId: user.uid,
        userName: user.displayName || 'Me',
        duration: seconds,
        volume: totalVolume,
        exercises: cleanExercises,
        muscles: Array.from(new Set(cleanExercises.map(e => e.muscle))),
        createdAt: serverTimestamp(),
      });

      setExercises([]);
      setSeconds(0);
      Alert.alert('Workout saved 💪', `Logged ${cleanExercises.length} exercise(s).`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
      setRunning(true);
    } finally {
      setSaving(false);
    }
  }, [exercises, seconds, totalVolume]);

  // ── Routine actions ──
  const handleSaveRoutine = useCallback((routine: Routine) => {
    setRoutines(prev => [...prev, routine]);
    setCreateRoutineVisible(false);
  }, []);

  const handleStartRoutine = useCallback((routine: Routine) => {
    if (exercises.length > 0) {
      Alert.alert(
        'Replace workout?',
        'Starting a routine will replace your current workout.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start Routine',
            onPress: () => {
              setExercises(routine.exercises.map(e => ({ ...e, id: uid(), sets: [{ id: uid(), weight: '', reps: '', done: false }] })));
              setSeconds(0);
            },
          },
        ]
      );
    } else {
      setExercises(routine.exercises.map(e => ({ ...e, id: uid(), sets: [{ id: uid(), weight: '', reps: '', done: false }] })));
    }
  }, [exercises.length]);

  const handleRoutineMenu = useCallback((routine: Routine) => {
    Alert.alert(routine.title, 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setRoutines(prev => prev.filter(r => r.id !== routine.id)),
      },
    ]);
  }, []);

  // ── Filtered library ──
  const filteredLibrary = EXERCISE_LIBRARY.filter(e => {
    const q = search.toLowerCase();
    const matchesSearch =
      e.name.toLowerCase().includes(q) ||
      e.muscle.toLowerCase().includes(q) ||
      e.equipment.toLowerCase().includes(q) ||
      e.difficulty.toLowerCase().includes(q);
    const matchesMuscle = muscleFilter === 'All' || e.muscle === muscleFilter;
    return matchesSearch && matchesMuscle;
  });

  const filteredRoutineLibrary = EXERCISE_LIBRARY.filter(e => {
    const q = routineSearch.toLowerCase();
    const matchesSearch =
      e.name.toLowerCase().includes(q) ||
      e.muscle.toLowerCase().includes(q) ||
      e.equipment.toLowerCase().includes(q) ||
      e.difficulty.toLowerCase().includes(q);
    const matchesMuscle = routineMuscleFilter === 'All' || e.muscle === routineMuscleFilter;
    return matchesSearch && matchesMuscle;
  });

  const isActive = exercises.length > 0;
  const restProgress = restSeconds / REST_DURATION;

  const openVideo = useCallback((libId: string) => {
    const item = getLibItem(libId);
    if (item) {
      setVideoItem(item);
      setVideoVisible(true);
    }
  }, []);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>

      {/* ── TOP NAVIGATION ── */}
      <View style={styles.topNav}>
        <Text style={styles.topNavTitle}>Workout</Text>
      </View>

      {/* ── REST TIMER BAR ── */}
      {restRunning && (
        <View style={styles.restBar}>
          <View style={styles.restBarBg}>
            <View style={[styles.restBarFill, { width: `${(1 - restProgress) * 100}%` }]} />
          </View>
          <View style={styles.restBarContent}>
            <Ionicons name="timer-outline" size={r.scale(14, 12, 18)} color="#007AFF" />
            <Text style={styles.restBarText}>Rest  {formatTime(REST_DURATION - restSeconds)}</Text>
            <TouchableOpacity
              onPress={() => { setRestRunning(false); setRestSeconds(0); }}
              hitSlop={{ top: r.touchTarget / 2, bottom: r.touchTarget / 2, left: r.touchTarget / 2, right: r.touchTarget / 2 }}
              accessibilityRole="button"
              accessibilityLabel="Skip rest"
            >
              <Text style={styles.restSkip}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.feed}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: r.spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── ACTIVE WORKOUT TIMER ── */}
        {isActive && (
          <View style={styles.activeWorkoutBanner}>
            <View>
              <Text style={styles.activeWorkoutLabel}>In Progress</Text>
              <Text style={styles.activeWorkoutTimer}>{formatTime(seconds)}</Text>
            </View>
            <View style={styles.activeWorkoutStats}>
              <View style={styles.activeStatItem}>
                <Text style={styles.activeStatVal}>{exercises.length}</Text>
                <Text style={styles.activeStatLabel}>Exercises</Text>
              </View>
              <View style={styles.activeStatDivider} />
              <View style={styles.activeStatItem}>
                <Text style={styles.activeStatVal}>{totalSetsDone}</Text>
                <Text style={styles.activeStatLabel}>Sets</Text>
              </View>
              <View style={styles.activeStatDivider} />
              <View style={styles.activeStatItem}>
                <Text style={styles.activeStatVal}>{totalVolume > 0 ? totalVolume.toLocaleString() : '—'}</Text>
                <Text style={styles.activeStatLabel}>kg vol</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleDiscard}
              style={styles.discardBtn}
              hitSlop={{ top: r.touchTarget / 2, bottom: r.touchTarget / 2, left: r.touchTarget / 2, right: r.touchTarget / 2 }}
              accessibilityRole="button"
              accessibilityLabel="Discard workout"
            >
              <Text style={styles.discardText}>Discard</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── START EMPTY WORKOUT ── */}
        {!isActive && (
          <TouchableOpacity
            style={styles.startEmptyBtn}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Start empty workout"
          >
            <Ionicons name="add" size={r.scale(20, 18, 24)} color="#fff" style={{ marginRight: r.spacing.sm }} />
            <Text style={styles.startEmptyBtnText}>Start Empty Workout</Text>
          </TouchableOpacity>
        )}

        {/* ── EXERCISE CARDS ── */}
        {exercises.map((ex, exIdx) => {
          const lib = getLibItem(ex.libId);
          const colors = muscleColors[ex.muscle] ?? { bg: '#F2F2F7', text: '#8E8E93' };
          const diff = lib ? difficultyColors[lib.difficulty] ?? { bg: '#F2F2F7', text: '#8E8E93' } : null;
          const completedSets = ex.sets.filter(s => s.done).length;
          const nextEx = exercises[exIdx + 1];
          const nextLib = nextEx ? getLibItem(nextEx.libId) : null;

          return (
            <View key={ex.id} style={styles.exerciseCard}>
              {/* Thumbnail */}
              {lib && (
                <TouchableOpacity
                  style={styles.thumbWrap}
                  activeOpacity={0.88}
                  onPress={() => openVideo(ex.libId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Watch form for ${ex.name}`}
                >
                  <LazyImage uri={lib.thumbnail} style={styles.thumb} />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.55)']}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View style={styles.playBtnWrap}>
                    <View style={styles.playBtn}>
                      <Ionicons name="play" size={r.scale(16, 14, 20)} color="#fff" style={{ marginLeft: 2 }} />
                    </View>
                    <Text style={styles.playLabel}>Watch Form</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Card header */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardExName} numberOfLines={1}>{ex.name}</Text>
                  <View style={styles.cardMeta}>
                    <View style={[styles.chip, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.chipText, { color: colors.text }]}>{ex.muscle}</Text>
                    </View>
                    {diff && lib && (
                      <View style={[styles.chip, { backgroundColor: diff.bg }]}>
                        <Text style={[styles.chipText, { color: diff.text }]}>{lib.difficulty}</Text>
                      </View>
                    )}
                    <Text style={styles.cardSetCount}>{completedSets}/{ex.sets.length} sets</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => removeExercise(ex.id)}
                  style={styles.removeExBtn}
                  hitSlop={{ top: r.touchTarget / 2, bottom: r.touchTarget / 2, left: r.touchTarget / 2, right: r.touchTarget / 2 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${ex.name}`}
                >
                  <Ionicons name="trash-outline" size={r.scale(17, 15, 21)} color="#C7C7CC" />
                </TouchableOpacity>
              </View>

              {/* Column headers */}
              <View style={styles.setColHeaders}>
                <Text style={[styles.setColLabel, { width: 28 }]}>SET</Text>
                <Text style={[styles.setColLabel, { flex: 1 }]}>KG</Text>
                <Text style={[styles.setColLabel, { flex: 1 }]}>REPS</Text>
                <View style={{ width: r.touchTarget + r.spacing.sm }} />
              </View>

              {/* Set rows */}
              {ex.sets.map((set, idx) => (
                <View key={set.id} style={[styles.setRow, set.done && styles.setRowDone]}>
                  <Text style={[styles.setNum, set.done && styles.setNumDone]}>{idx + 1}</Text>
                  <TextInput
                    style={[styles.setInput, set.done && styles.setInputDone]}
                    value={set.weight}
                    onChangeText={v => updateSet(ex.id, set.id, 'weight', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#C7C7CC"
                    editable={!set.done}
                    accessibilityLabel={`Weight for set ${idx + 1}`}
                  />
                  <TextInput
                    style={[styles.setInput, set.done && styles.setInputDone]}
                    value={set.reps}
                    onChangeText={v => updateSet(ex.id, set.id, 'reps', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#C7C7CC"
                    editable={!set.done}
                    accessibilityLabel={`Reps for set ${idx + 1}`}
                  />
                  <TouchableOpacity
                    style={[styles.checkBtn, set.done && styles.checkBtnDone]}
                    onPress={() => toggleSetDone(ex.id, set.id)}
                    hitSlop={{ top: r.touchTarget / 4, bottom: r.touchTarget / 4, left: r.touchTarget / 4, right: r.touchTarget / 4 }}
                    accessibilityRole="button"
                    accessibilityLabel={set.done ? `Unmark set ${idx + 1}` : `Mark set ${idx + 1} done`}
                    accessibilityState={{ checked: set.done }}
                  >
                    <Ionicons name="checkmark" size={r.scale(15, 13, 19)} color={set.done ? '#fff' : '#C7C7CC'} />
                  </TouchableOpacity>
                  {!set.done ? (
                    <TouchableOpacity
                      onPress={() => removeSet(ex.id, set.id)}
                      style={styles.removeSetBtn}
                      hitSlop={{ top: r.touchTarget / 2, bottom: r.touchTarget / 2, left: r.touchTarget / 2, right: r.touchTarget / 2 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove set ${idx + 1}`}
                    >
                      <Ionicons name="close" size={r.scale(13, 11, 17)} color="#C7C7CC" />
                    </TouchableOpacity>
                  ) : (
                    <View style={{ width: r.touchTarget / 2 }} />
                  )}
                </View>
              ))}

              {/* Add Set */}
              <TouchableOpacity
                style={styles.addSetBtn}
                onPress={() => addSet(ex.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Add set to ${ex.name}`}
              >
                <Ionicons name="add" size={r.scale(15, 13, 19)} color="#007AFF" />
                <Text style={styles.addSetText}>Add Set</Text>
              </TouchableOpacity>

              {/* Next Up */}
              {nextEx && (
                <View style={styles.nextUpRow}>
                  <Text style={styles.nextUpLabel}>Next up</Text>
                  {nextLib && (
                    <LazyImage uri={nextLib.thumbnail} style={styles.nextUpThumb} />
                  )}
                  <Text style={styles.nextUpName} numberOfLines={1}>{nextEx.name}</Text>
                  <View style={[styles.chip, { backgroundColor: (muscleColors[nextEx.muscle] ?? { bg: '#F2F2F7' }).bg }]}>
                    <Text style={[styles.chipText, { color: (muscleColors[nextEx.muscle] ?? { text: '#8E8E93' }).text }]}>
                      {nextEx.muscle}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* ── ADD EXERCISE (during active workout) ── */}
        {isActive && (
          <TouchableOpacity
            style={styles.addExerciseBtnLight}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add exercise"
          >
            <Ionicons name="add" size={r.scale(18, 16, 22)} color="#007AFF" style={{ marginRight: r.spacing.sm }} />
            <Text style={styles.addExerciseBtnLightText}>Add Exercise</Text>
          </TouchableOpacity>
        )}

        {/* ── FINISH WORKOUT ── */}
        {isActive && (
          <TouchableOpacity
            style={[styles.finishBtn, saving && { opacity: 0.6 }]}
            onPress={handleFinish}
            disabled={saving}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={saving ? 'Saving workout' : 'Finish workout'}
            accessibilityState={{ disabled: saving }}
          >
            <Ionicons name="checkmark-circle-outline" size={r.scale(20, 18, 24)} color="#fff" style={{ marginRight: r.spacing.sm }} />
            <Text style={styles.finishText}>{saving ? 'Saving…' : 'Finish Workout'}</Text>
          </TouchableOpacity>
        )}

        {/* ── ROUTINES SECTION ── */}
        {!isActive && (
          <View style={{ marginTop: r.spacing.md }}>
            {/* Section header */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderText}>Routines</Text>
              <TouchableOpacity
                onPress={() => setCreateRoutineVisible(true)}
                style={styles.sectionHeaderIcon}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Create new routine"
              >
                <Ionicons name="add-outline" size={r.scale(22, 20, 26)} color="#000" />
              </TouchableOpacity>
            </View>

            {/* New Routine + Explore buttons */}
            <View style={styles.routineActionsRow}>
              <TouchableOpacity
                style={styles.routineActionCard}
                onPress={() => setCreateRoutineVisible(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Create new routine"
              >
                <Ionicons name="clipboard-outline" size={r.scale(20, 18, 24)} color="#000" style={{ marginBottom: r.spacing.xs }} />
                <Text style={styles.routineActionText}>New Routine</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.routineActionCard}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Explore routines"
              >
                <Ionicons name="search-outline" size={r.scale(20, 18, 24)} color="#000" style={{ marginBottom: r.spacing.xs }} />
                <Text style={styles.routineActionText}>Explore</Text>
              </TouchableOpacity>
            </View>

            {/* My Routines collapsible */}
            <RoutineList
              routines={routines}
              onStart={handleStartRoutine}
              onMenu={handleRoutineMenu}
              r={r}
            />
          </View>
        )}
      </ScrollView>

      {/* ── EXERCISE PICKER MODAL ── */}
      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => {
          setPickerVisible(false);
          setSearch('');
          setMuscleFilter('All');
        }}
        search={search}
        setSearch={setSearch}
        muscleFilter={muscleFilter}
        setMuscleFilter={setMuscleFilter}
        filteredLibrary={filteredLibrary}
        onSelectExercise={addExercise}
        r={r}
      />

      {/* ── CREATE ROUTINE MODAL ── */}
      <CreateRoutineScreen
        visible={createRoutineVisible}
        onCancel={() => setCreateRoutineVisible(false)}
        onSave={handleSaveRoutine}
        pickerVisible={routinePickerVisible}
        setPickerVisible={setRoutinePickerVisible}
        search={routineSearch}
        setSearch={setRoutineSearch}
        muscleFilter={routineMuscleFilter}
        setMuscleFilter={setRoutineMuscleFilter}
        filteredLibrary={filteredRoutineLibrary}
        r={r}
      />

      {/* ── VIDEO DETAIL MODAL ── */}
      <VideoModal
        item={videoItem}
        visible={videoVisible}
        onClose={() => setVideoVisible(false)}
        r={r}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Responsive Stylesheet Generators
// ─────────────────────────────────────────────

const getMainStyles = (r: ReturnType<typeof createResponsiveScale>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#fff' },
    topNav: {
      paddingHorizontal: r.contentHPadding,
      paddingTop: r.spacing.md,
      paddingBottom: r.spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#E5E5EA',
      backgroundColor: '#fff',
    },
    topNavTitle: {
      fontSize: r.fontSize.xxl,
      fontWeight: '800',
      color: '#000',
      letterSpacing: -0.5,
    },
    feed: { flex: 1, paddingHorizontal: r.contentHPadding },
    startEmptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000',
      borderRadius: r.scale(14, 12, 18),
      paddingVertical: r.scale(18, 16, 22),
      marginTop: r.spacing.lg,
      marginBottom: r.spacing.xl,
      minHeight: r.touchTarget,
    },
    startEmptyBtnText: { color: '#fff', fontSize: r.fontSize.base, fontWeight: '700' },
    activeWorkoutBanner: {
      backgroundColor: '#F2F2F7',
      borderRadius: r.scale(16, 14, 20),
      padding: r.spacing.lg,
      marginTop: r.spacing.lg,
      marginBottom: r.spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#E5E5EA',
    },
    activeWorkoutLabel: {
      fontSize: r.fontSize.xs,
      fontWeight: '600',
      color: '#8E8E93',
      marginBottom: r.spacing.xs,
    },
    activeWorkoutTimer: {
      fontSize: r.fontSize.xxxl,
      fontWeight: '900',
      color: '#000',
      letterSpacing: -1,
      marginBottom: r.spacing.lg,
    },
    activeWorkoutStats: { flexDirection: 'row', marginBottom: r.spacing.lg },
    activeStatItem: { flex: 1, alignItems: 'center' },
    activeStatVal: { fontSize: r.fontSize.lg, fontWeight: '800', color: '#000' },
    activeStatLabel: { fontSize: r.fontSize.xs, color: '#8E8E93', marginTop: r.spacing.xs },
    activeStatDivider: { width: 1, backgroundColor: '#E5E5EA', marginVertical: r.spacing.sm },
    discardBtn: {
      paddingHorizontal: r.spacing.md,
      paddingVertical: r.scale(9, 8, 12),
      backgroundColor: 'rgba(255,59,48,0.08)',
      borderRadius: r.scale(10, 8, 12),
      borderWidth: 1,
      borderColor: 'rgba(255,59,48,0.2)',
      alignSelf: 'flex-start',
      minHeight: r.touchTarget,
      justifyContent: 'center',
    },
    discardText: { fontSize: r.fontSize.sm, color: '#FF3B30', fontWeight: '700' },
    restBar: {
      marginHorizontal: r.contentHPadding,
      marginBottom: r.spacing.md,
      backgroundColor: '#F2F2F7',
      borderRadius: r.scale(12, 10, 16),
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#E5E5EA',
    },
    restBarBg: { height: 3, backgroundColor: '#E5E5EA', width: '100%' },
    restBarFill: { height: 3, backgroundColor: '#007AFF', position: 'absolute', left: 0, top: 0 },
    restBarContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: r.spacing.lg,
      paddingVertical: r.spacing.md,
      gap: r.spacing.sm,
    },
    restBarText: { flex: 1, fontSize: r.fontSize.sm, fontWeight: '600', color: '#007AFF' },
    restSkip: { fontSize: r.fontSize.xs, color: '#8E8E93', fontWeight: '600' },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: r.spacing.lg,
    },
    sectionHeaderText: { fontSize: r.fontSize.xl, fontWeight: '800', color: '#000' },
    sectionHeaderIcon: {
      width: r.touchTarget,
      height: r.touchTarget,
      borderRadius: r.scale(8, 6, 12),
      backgroundColor: '#F2F2F7',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#E5E5EA',
    },
    routineActionsRow: { flexDirection: 'row', gap: r.spacing.md, marginBottom: r.spacing.xl },
    routineActionCard: {
      flex: 1,
      backgroundColor: '#F2F2F7',
      borderRadius: r.scale(16, 14, 20),
      paddingVertical: r.scale(18, 16, 22),
      paddingHorizontal: r.spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#E5E5EA',
      justifyContent: 'center',
      alignItems: 'center',
      gap: r.spacing.sm,
      minHeight: r.scale(100, 90, 120),
    },
    routineActionText: { fontSize: r.fontSize.base, fontWeight: '700', color: '#000' },
    exerciseCard: {
      backgroundColor: '#fff',
      borderRadius: r.scale(20, 18, 24),
      overflow: 'hidden',
      marginBottom: r.spacing.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#E5E5EA',
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    thumbWrap: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: '#E5E5EA',
      position: 'relative',
      justifyContent: 'flex-end',
    },
    thumb: { width: '100%', height: '100%' },
    playBtnWrap: {
      position: 'absolute',
      bottom: r.spacing.lg,
      left: r.spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: r.spacing.md,
    },
    playBtn: {
      width: r.scale(34, 32, 42),
      height: r.scale(34, 32, 42),
      borderRadius: r.scale(17, 16, 21),
      backgroundColor: 'rgba(0,122,255,0.85)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    playLabel: { color: '#fff', fontSize: r.fontSize.xs, fontWeight: '700', letterSpacing: 0.3 },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: r.spacing.lg,
      paddingBottom: 0,
      gap: r.spacing.md,
    },
    cardExName: { fontSize: r.fontSize.base, fontWeight: '800', color: '#000', marginBottom: r.spacing.xs },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: r.spacing.sm, flexWrap: 'wrap' },
    cardSetCount: { fontSize: r.fontSize.xs, color: '#8E8E93', fontWeight: '600' },
    removeExBtn: { padding: r.spacing.sm, minHeight: r.touchTarget, minWidth: r.touchTarget, justifyContent: 'center', alignItems: 'center' },
    setColHeaders: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: r.spacing.lg,
      marginTop: r.spacing.lg,
      marginBottom: r.spacing.md,
      gap: r.spacing.sm,
    },
    setColLabel: { fontSize: r.fontSize.xs, fontWeight: '700', color: '#C7C7CC', letterSpacing: 0.5 },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: r.spacing.sm,
      backgroundColor: '#F2F2F7',
      borderRadius: r.scale(12, 10, 16),
      paddingVertical: r.scale(10, 8, 14),
      paddingHorizontal: r.spacing.md,
      marginHorizontal: r.spacing.lg,
      marginBottom: r.spacing.md,
    },
    setRowDone: { backgroundColor: '#F0FDF4' },
    setNum: { width: 20, fontSize: r.fontSize.sm, fontWeight: '800', color: '#8E8E93', textAlign: 'center' },
    setNumDone: { color: '#16A34A' },
    setInput: {
      flex: 1,
      backgroundColor: '#fff',
      borderRadius: r.scale(10, 8, 12),
      paddingHorizontal: r.spacing.md,
      paddingVertical: r.scale(9, 8, 12),
      fontSize: r.fontSize.base,
      fontWeight: '700',
      color: '#000',
      borderWidth: 1,
      borderColor: '#E5E5EA',
      textAlign: 'center',
      minHeight: r.touchTarget,
    },
    setInputDone: {
      borderColor: '#BBF7D0',
      color: '#16A34A',
      backgroundColor: '#F0FDF4',
    },
    checkBtn: {
      width: r.touchTarget,
      height: r.touchTarget,
      borderRadius: r.scale(10, 8, 12),
      backgroundColor: '#fff',
      borderWidth: 1.5,
      borderColor: '#E5E5EA',
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkBtnDone: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
    removeSetBtn: { width: r.touchTarget / 2, justifyContent: 'center', alignItems: 'center', height: r.touchTarget },
    addSetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: r.spacing.sm,
      paddingVertical: r.scale(11, 10, 14),
      marginHorizontal: r.spacing.lg,
      marginBottom: r.spacing.lg,
      marginTop: r.spacing.xs,
      backgroundColor: '#F2F2F7',
      borderRadius: r.scale(12, 10, 16),
      minHeight: r.touchTarget,
    },
    addSetText: { fontSize: r.fontSize.sm, fontWeight: '700', color: '#007AFF' },
    nextUpRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: r.spacing.sm,
      marginHorizontal: r.spacing.lg,
      marginBottom: r.spacing.lg,
      paddingTop: r.spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: '#E5E5EA',
    },
    nextUpLabel: { fontSize: r.fontSize.xs, color: '#8E8E93', fontWeight: '600' },
    nextUpThumb: { width: r.scale(32, 30, 40), height: r.scale(32, 30, 40), borderRadius: r.scale(8, 6, 12) },
    nextUpName: { fontSize: r.fontSize.sm, fontWeight: '700', color: '#000', flex: 1 },
    chip: { paddingHorizontal: r.spacing.sm, paddingVertical: r.scale(3, 2, 5), borderRadius: 20 },
    chipText: { fontSize: r.fontSize.xs, fontWeight: '700' },
    addExerciseBtnLight: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F2F2F7',
      borderRadius: r.scale(14, 12, 18),
      paddingVertical: r.scale(14, 12, 18),
      marginBottom: r.spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#E5E5EA',
      minHeight: r.touchTarget,
    },
    addExerciseBtnLightText: { color: '#007AFF', fontSize: r.fontSize.base, fontWeight: '700' },
    finishBtn: {
      backgroundColor: '#16A34A',
      borderRadius: r.scale(16, 14, 20),
      paddingVertical: r.scale(16, 14, 20),
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: r.spacing.md,
      minHeight: r.touchTarget,
    },
    finishText: { color: '#fff', fontSize: r.fontSize.base, fontWeight: '800', letterSpacing: 0.3 },
  });

const getRoutineCardStyles = (r: ReturnType<typeof createResponsiveScale>) =>
  StyleSheet.create({
    card: {
      backgroundColor: '#F2F2F7',
      borderRadius: r.scale(16, 14, 20),
      padding: r.spacing.lg,
      marginBottom: r.spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#E5E5EA',
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: r.spacing.sm },
    cardTitle: { fontSize: r.fontSize.base, fontWeight: '800', color: '#000', flex: 1 },
    cardExercises: { fontSize: r.fontSize.sm, color: '#8E8E93', marginBottom: r.spacing.lg, lineHeight: 19 },
    startBtn: {
      backgroundColor: '#000',
      borderRadius: r.scale(12, 10, 16),
      paddingVertical: r.scale(14, 12, 18),
      alignItems: 'center',
      minHeight: r.touchTarget,
      justifyContent: 'center',
    },
    startBtnText: { color: '#fff', fontSize: r.fontSize.base, fontWeight: '800' },
  });

const getRoutineListStyles = (r: ReturnType<typeof createResponsiveScale>) => {
  const isTablet = r.screen.isTablet;
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: r.spacing.md,
      paddingVertical: r.spacing.md,
    },
    headerText: { fontSize: r.fontSize.base, fontWeight: '600', color: '#8E8E93' },
    cardGrid: {
      flexDirection: isTablet ? 'row' : 'column',
      flexWrap: isTablet ? 'wrap' : 'nowrap',
      gap: r.spacing.md,
    },
    cardWrapper: {
      width: isTablet ? '48%' : '100%',
    },
  });
};

const getCreateRoutineStyles = (r: ReturnType<typeof createResponsiveScale>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#fff' },
    nav: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: r.contentHPadding,
      paddingVertical: r.spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#E5E5EA',
    },
    cancelText: { fontSize: r.fontSize.base, color: '#007AFF', fontWeight: '600' },
    navTitle: { fontSize: r.fontSize.base, fontWeight: '800', color: '#000' },
    saveBtn: {
      backgroundColor: '#000',
      borderRadius: r.scale(10, 8, 12),
      paddingHorizontal: r.spacing.lg,
      paddingVertical: r.spacing.md,
      minHeight: r.touchTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.3 },
    saveText: { fontSize: r.fontSize.sm, fontWeight: '700', color: '#fff' },
    titleInput: {
      fontSize: r.fontSize.xl,
      fontWeight: '700',
      color: '#000',
      paddingHorizontal: r.contentHPadding,
      paddingTop: r.spacing.xl,
      paddingBottom: r.spacing.md,
    },
    titleDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E5EA', marginHorizontal: r.contentHPadding },
    empty: {
      alignItems: 'center',
      paddingTop: r.spacing.xxl * 2,
      paddingHorizontal: r.spacing.xl,
    },
    emptyIcon: { fontSize: r.fontSize.xxxl, marginBottom: r.spacing.xl },
    emptyText: {
      fontSize: r.fontSize.base,
      color: '#8E8E93',
      textAlign: 'center',
      lineHeight: 22,
    },
    addExBtn: {
      backgroundColor: '#000',
      borderRadius: r.scale(16, 14, 20),
      paddingVertical: r.scale(16, 14, 20),
      marginHorizontal: r.contentHPadding,
      marginTop: r.spacing.xxl,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      minHeight: r.touchTarget,
    },
    addExBtnText: { color: '#fff', fontSize: r.fontSize.base, fontWeight: '800' },
    exCard: {
      backgroundColor: '#F2F2F7',
      borderRadius: r.scale(16, 14, 20),
      padding: r.spacing.lg,
      marginBottom: r.spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#E5E5EA',
    },
    exCardHeader: { flexDirection: 'row', alignItems: 'center', gap: r.spacing.md, marginBottom: r.spacing.lg },
    exThumb: { width: r.scale(52, 48, 64), height: r.scale(40, 36, 48), borderRadius: r.scale(8, 6, 12) },
    exName: { fontSize: r.fontSize.sm, fontWeight: '800', color: '#000', marginBottom: r.spacing.xs },
    exMuscle: { fontSize: r.fontSize.xs, color: '#8E8E93' },
    exSetRow: {
      flexDirection: 'row',
      paddingHorizontal: r.spacing.sm,
      marginBottom: r.spacing.sm,
    },
    exSetLabel: { flex: 1, fontSize: r.fontSize.xs, fontWeight: '700', color: '#C7C7CC', letterSpacing: 0.5 },
    exSetDataRow: { flexDirection: 'row', paddingHorizontal: r.spacing.sm, marginBottom: r.spacing.xs },
    exSetNum: { flex: 1, fontSize: r.fontSize.sm, color: '#8E8E93', fontWeight: '700' },
    exSetVal: { flex: 1, fontSize: r.fontSize.sm, color: '#000', fontWeight: '700' },
  });

const getExercisePickerStyles = (r: ReturnType<typeof createResponsiveScale>) =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
    sheet: {
      backgroundColor: '#fff',
      borderTopLeftRadius: r.scale(28, 24, 32),
      borderTopRightRadius: r.scale(28, 24, 32),
      paddingTop: r.spacing.md,
      height: '85%',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: '#E5E5EA',
    },
    handle: {
      width: r.scale(40, 36, 48),
      height: 4,
      borderRadius: 2,
      backgroundColor: '#E5E5EA',
      alignSelf: 'center',
      marginBottom: r.spacing.lg,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: r.contentHPadding,
      marginBottom: r.spacing.lg,
    },
    title: { fontSize: r.fontSize.xl, fontWeight: '900', color: '#000' },
    closeBtn: {
      width: r.touchTarget,
      height: r.touchTarget,
      borderRadius: r.touchTarget / 2,
      backgroundColor: '#F2F2F7',
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: r.spacing.md,
      backgroundColor: '#F2F2F7',
      borderRadius: r.scale(12, 10, 16),
      paddingHorizontal: r.spacing.lg,
      paddingVertical: r.scale(11, 10, 14),
      marginHorizontal: r.contentHPadding,
      marginBottom: r.spacing.md,
    },
    searchInput: { flex: 1, fontSize: r.fontSize.sm, color: '#000' },
    filterRow: { marginBottom: r.spacing.md, flexGrow: 0 },
    filterChip: {
      paddingHorizontal: r.spacing.lg,
      paddingVertical: r.spacing.sm,
      backgroundColor: '#F2F2F7',
      borderRadius: 20,
      minHeight: r.touchTarget,
      justifyContent: 'center',
    },
    filterChipActive: { backgroundColor: '#000' },
    filterChipText: { fontSize: r.fontSize.sm, fontWeight: '600', color: '#8E8E93' },
    filterChipTextActive: { color: '#fff' },
    list: { flex: 1, paddingHorizontal: r.contentHPadding },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: r.spacing.lg,
      paddingVertical: r.scale(13, 11, 16),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#E5E5EA',
      minHeight: r.touchTarget,
    },
    rowThumb: { width: r.scale(60, 56, 72), height: r.scale(44, 40, 52), borderRadius: r.scale(10, 8, 12) },
    rowName: { fontSize: r.fontSize.sm, color: '#000', fontWeight: '700', marginBottom: r.spacing.xs },
    rowBadges: { flexDirection: 'row', gap: r.spacing.sm, marginBottom: r.spacing.xs, flexWrap: 'wrap' },
    equipRow: { flexDirection: 'row', alignItems: 'center', gap: r.spacing.xs },
    equipText: { fontSize: r.fontSize.xs, color: '#8E8E93' },
    addBtn: {
      width: r.touchTarget,
      height: r.touchTarget,
      borderRadius: r.scale(10, 8, 12),
      backgroundColor: '#F2F2F7',
      justifyContent: 'center',
      alignItems: 'center',
    },
    chip: { paddingHorizontal: r.spacing.sm, paddingVertical: r.spacing.xs, borderRadius: 20 },
    chipText: { fontSize: r.fontSize.xs, fontWeight: '700' },
  });

const getVideoModalStyles = (r: ReturnType<typeof createResponsiveScale>) => {
  const videoWidth = r.screen.isTablet ? Math.min(r.screen.width * 0.9, 900) : r.screen.width;
  const videoHeight = (videoWidth * 9) / 16;

  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: '#fff',
      borderTopLeftRadius: r.scale(28, 24, 32),
      borderTopRightRadius: r.scale(28, 24, 32),
      overflow: 'hidden',
      maxHeight: r.screen.height * 0.92,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: '#E5E5EA',
    },
    videoWrap: {
      width: '100%',
      height: videoHeight,
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center',
    },
    video: { width: '100%', height: '100%' },
    closeBtn: {
      position: 'absolute',
      top: r.spacing.lg,
      right: r.spacing.lg,
      width: r.scale(34, 32, 42),
      height: r.scale(34, 32, 42),
      borderRadius: r.scale(17, 16, 21),
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoScroll: { paddingHorizontal: r.contentHPadding, paddingTop: r.spacing.lg },
    title: { fontSize: r.fontSize.xl, fontWeight: '900', color: '#000', marginBottom: r.spacing.md },
    badgeRow: { flexDirection: 'row', gap: r.spacing.md, flexWrap: 'wrap', marginBottom: r.spacing.xl },
    badge: { paddingHorizontal: r.spacing.lg, paddingVertical: r.spacing.sm, borderRadius: 20 },
    badgeText: { fontSize: r.fontSize.sm, fontWeight: '700' },
    equipBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: r.spacing.lg,
      paddingVertical: r.spacing.sm,
      borderRadius: 20,
      backgroundColor: '#F2F2F7',
      minHeight: r.touchTarget,
      justifyContent: 'center',
    },
    equipText: { fontSize: r.fontSize.sm, fontWeight: '600', color: '#8E8E93' },
    sectionLabel: {
      fontSize: r.fontSize.xs,
      fontWeight: '700',
      color: '#C7C7CC',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: r.spacing.md,
      marginTop: r.spacing.xl,
    },
    description: { fontSize: r.fontSize.sm, color: '#3C3C43', lineHeight: 21 },
    muscleTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: r.spacing.md },
    muscleTag: {
      paddingHorizontal: r.spacing.lg,
      paddingVertical: r.spacing.sm,
      backgroundColor: '#F2F2F7',
      borderRadius: 20,
      minHeight: r.touchTarget,
      justifyContent: 'center',
    },
    muscleTagSecondary: { backgroundColor: '#F2F2F7' },
    muscleTagText: { fontSize: r.fontSize.sm, fontWeight: '600', color: '#007AFF' },
  });
};