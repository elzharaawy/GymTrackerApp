/**
 * HomeScreen.tsx
 *
 * CHANGE SCOPE (per request): ONLY the "Today's Summary" section (and its icons)
 * was touched. Auth, Firestore writes for streak/calendar, calendar UI, week
 * strip, streak calculation, navigation, and responsive layout are UNCHANGED.
 *
 * NEW: Today's Summary now reads real data from the same `workouts` Firestore
 * collection used by WorkoutScreen (collection('workouts'), filtered by
 * userId, same field shape: duration, volume, exercises[], muscles[],
 * createdAt). No new collection/structure was created.
 *
 * IMPORTANT INTEGRATION NOTE:
 * This file imports `EXERCISE_LIBRARY` and `getLibItem` from WorkoutScreen so
 * thumbnails can be reused instead of duplicating the exercise data. In
 * WorkoutScreen.tsx, change:
 *   const EXERCISE_LIBRARY: ExerciseLibItem[] = [ ... ]
 *   const getLibItem = (libId: string) => ...
 * to:
 *   export const EXERCISE_LIBRARY: ExerciseLibItem[] = [ ... ]
 *   export const getLibItem = (libId: string) => ...
 * That is the ONLY change required in WorkoutScreen.tsx — no business logic,
 * Firestore writes, or UI behavior there is modified.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Animated,
  Image,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebaseConfig';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  limit,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
// Reused from WorkoutScreen — same exercise data, same thumbnails, no duplication.
import { EXERCISE_LIBRARY, getLibItem } from './workout';

const { width } = Dimensions.get('window');

// --- Date helpers (unchanged) ---
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return toDateKey(a) === toDateKey(b);
}

function buildMonthGrid(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function computeStreakAndTotal(workoutDays: Record<string, boolean>, today: Date) {
  const totalWorkouts = Object.values(workoutDays).filter(Boolean).length;
  let streakDays = 0;
  const cursor = new Date(today);
  if (!workoutDays[toDateKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
  while (workoutDays[toDateKey(cursor)]) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { streakDays, totalWorkouts };
}

function buildWeekStrip(today: Date) {
  const days: Date[] = [];
  const startDay = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - startDay);
  for (let i = 0; i < 7; i++) {
    days.push(new Date(weekStart.getTime() + i * ONE_DAY_MS));
  }
  return days;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatClock(d: Date | null) {
  if (!d) return '—';
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function formatDuration(totalSeconds: number) {
  const mins = Math.round(totalSeconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

// ─────────────────────────────────────────────
// Today's workout data types + Firestore loader
// (Reuses the exact `workouts` collection/shape WorkoutScreen writes to.)
// ─────────────────────────────────────────────

interface SavedSet {
  weight: string;
  reps: string;
}
interface SavedExercise {
  name: string;
  muscle: string;
  sets: SavedSet[];
}
interface SavedWorkoutDoc {
  id: string;
  userId: string;
  duration: number; // seconds
  volume: number;
  exercises: SavedExercise[];
  muscles: string[];
  createdAt: Date | null;
}

interface TodaySummary {
  hasWorkout: boolean;
  totalExercises: number;
  totalSets: number;
  totalVolume: number;
  totalReps: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  estimatedCalories: number;
  muscleGroups: string[];
  startedAt: Date | null;
  finishedAt: Date | null;
  exerciseNames: string[]; // for thumbnail lookups, in session order
  goalExercises: number;
  goalSets: number;
  goalDurationSeconds: number;
  goalVolume: number;
}

const EMPTY_SUMMARY: TodaySummary = {
  hasWorkout: false,
  totalExercises: 0,
  totalSets: 0,
  totalVolume: 0,
  totalReps: 0,
  totalDurationSeconds: 0,
  avgDurationSeconds: 0,
  estimatedCalories: 0,
  muscleGroups: [],
  startedAt: null,
  finishedAt: null,
  exerciseNames: [],
  goalExercises: 8,
  goalSets: 20,
  goalDurationSeconds: 60 * 60,
  goalVolume: 8000,
};

/** Loads today's workout session(s) for the current user and aggregates stats. */
async function loadTodaySummary(userId: string, today: Date): Promise<TodaySummary> {
  const dayStart = startOfDay(today);
  const dayEnd = new Date(dayStart.getTime() + ONE_DAY_MS);

  // NOTE: intentionally no orderBy() here — combining where('userId', ...)
  // with orderBy('createdAt', ...) requires a Firestore composite index.
  // Without that index the query throws, gets swallowed by the catch in
  // loadSummary(), and silently renders the empty state. Sorting is done
  // client-side below instead, since we only need ~today's docs anyway.
  const q = query(
    collection(db, 'workouts'),
    where('userId', '==', userId),
    limit(50)
  );
  const snap = await getDocs(q);

  const todayDocs: SavedWorkoutDoc[] = [];
  snap.forEach(d => {
    const data = d.data();
    const createdAt: Date | null =
      data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null;
    if (createdAt && createdAt >= dayStart && createdAt < dayEnd) {
      todayDocs.push({
        id: d.id,
        userId: data.userId,
        duration: data.duration || 0,
        volume: data.volume || 0,
        exercises: data.exercises || [],
        muscles: data.muscles || [],
        createdAt,
      });
    }
  });

  if (todayDocs.length === 0) return EMPTY_SUMMARY;

  let totalExercises = 0;
  let totalSets = 0;
  let totalVolume = 0;
  let totalReps = 0;
  let totalDurationSeconds = 0;
  const muscleSet = new Set<string>();
  const exerciseNames: string[] = [];
  let earliestStart: Date | null = null;
  let latestFinish: Date | null = null;

  todayDocs
    .slice()
    .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0))
    .forEach(w => {
      totalExercises += w.exercises.length;
      totalDurationSeconds += w.duration;
      totalVolume += w.volume;
      w.muscles.forEach(m => muscleSet.add(m));
      w.exercises.forEach(ex => {
        exerciseNames.push(ex.name);
        totalSets += ex.sets.length;
        ex.sets.forEach(s => {
          totalReps += parseFloat(s.reps) || 0;
        });
      });

      // No explicit "started" timestamp is stored — createdAt is the finish
      // time, so the session start is derived as (finishedAt - duration).
      const finishedAt = w.createdAt as Date;
      const startedAt = new Date(finishedAt.getTime() - w.duration * 1000);
      if (!earliestStart || startedAt < earliestStart) earliestStart = startedAt;
      if (!latestFinish || finishedAt > latestFinish) latestFinish = finishedAt;
    });

  // Calories are not tracked anywhere in the existing data model, so we
  // surface a clearly-labeled rough estimate derived from volume rather than
  // inventing a new Firestore field.
  const estimatedCalories = Math.round(totalVolume * 0.08 + (totalDurationSeconds / 60) * 4);

  return {
    hasWorkout: true,
    totalExercises,
    totalSets,
    totalVolume,
    totalReps,
    totalDurationSeconds,
    avgDurationSeconds: todayDocs.length ? totalDurationSeconds / todayDocs.length : 0,
    estimatedCalories,
    muscleGroups: Array.from(muscleSet),
    startedAt: earliestStart,
    finishedAt: latestFinish,
    exerciseNames,
    goalExercises: EMPTY_SUMMARY.goalExercises,
    goalSets: EMPTY_SUMMARY.goalSets,
    goalDurationSeconds: EMPTY_SUMMARY.goalDurationSeconds,
    goalVolume: EMPTY_SUMMARY.goalVolume,
  };
}

// ─────────────────────────────────────────────
// Today's Summary — card primitives
// ─────────────────────────────────────────────

interface SummaryCardDef {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  progress: number; // 0..1
  progressLabel: string;
  color: string;
  bg: string;
  section: string; // param passed to /workout
}

const SummaryCard = React.memo(function SummaryCard({
  def,
  index,
  onPress,
}: {
  def: SummaryCardDef;
  index: number;
  onPress: (section: string) => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.97)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: index * 60,
        useNativeDriver: true,
        friction: 7,
      }),
    ]).start();
    Animated.timing(progressAnim, {
      toValue: Math.min(def.progress, 1),
      duration: 700,
      delay: index * 60 + 150,
      useNativeDriver: false,
    }).start();
  }, [def.progress]);

  const handlePressIn = useCallback(() => {
    Animated.spring(pressAnim, { toValue: 0.96, useNativeDriver: true, friction: 6 }).start();
  }, []);
  const handlePressOut = useCallback(() => {
    Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
  }, []);

  const widthInterp = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        summaryStyles.cardWrap,
        { opacity: fadeAnim, transform: [{ scale: Animated.multiply(scaleAnim, pressAnim) }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPress(def.section)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={summaryStyles.card}
        accessibilityRole="button"
        accessibilityLabel={`${def.label}, ${def.value}`}
        accessibilityHint={`Opens the Workout screen scrolled to ${def.label.toLowerCase()}`}
      >
        <View style={[summaryStyles.iconCircle, { backgroundColor: def.bg }]}>
          <Ionicons name={def.icon} size={18} color={def.color} />
        </View>

        <Text style={summaryStyles.cardLabel}>{def.label}</Text>
        <Text style={summaryStyles.cardValue}>{def.value}</Text>

        <View style={summaryStyles.progressTrack}>
          <Animated.View
            style={[summaryStyles.progressFill, { width: widthInterp, backgroundColor: def.color }]}
          />
        </View>
        <Text style={summaryStyles.progressLabel}>{def.progressLabel}</Text>

        <View style={summaryStyles.tapRow}>
          <Text style={summaryStyles.tapText}>Tap to view</Text>
          <Ionicons name="chevron-forward" size={12} color="#9CA3AF" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const ThumbnailFade = React.memo(function ThumbnailFade({ uri }: { uri: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  return (
    <Image
      source={{ uri }}
      style={summaryStyles.thumbImg}
      onLoad={() => Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start()}
      resizeMode="cover"
    />
  );
});

const SummarySkeletonCard = React.memo(function SummarySkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] });
  return (
    <View style={summaryStyles.cardWrap}>
      <View style={summaryStyles.card}>
        <Animated.View style={[summaryStyles.skelCircle, { opacity }]} />
        <Animated.View style={[summaryStyles.skelLine, { opacity, width: '60%' }]} />
        <Animated.View style={[summaryStyles.skelLine, { opacity, width: '40%', height: 18, marginTop: 6 }]} />
        <Animated.View style={[summaryStyles.skelLine, { opacity, width: '100%', height: 6, marginTop: 12, borderRadius: 3 }]} />
      </View>
    </View>
  );
});

export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const today = useMemo(() => startOfDay(new Date()), []);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState<string | null>(user?.photoURL || null);
  const [workoutDays, setWorkoutDays] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showFullCalendar, setShowFullCalendar] = useState(false);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // ── Today's Summary state (NEW) ──
  const [todaySummary, setTodaySummary] = useState<TodaySummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    loadWorkoutDays();
    loadSummary();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const loadWorkoutDays = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'users', user!.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const days = data.workoutDays || {};
        setDisplayName(data.displayName || user!.displayName || '');
        // Load photoURL from Firestore (Cloudinary URL stored here)
        setPhotoURL(data.photoURL || user!.photoURL || null);
        setWorkoutDays(days);
        const { streakDays, totalWorkouts } = computeStreakAndTotal(days, today);
        if (data.streak !== streakDays || data.totalWorkouts !== totalWorkouts) {
          setDoc(docRef, { streak: streakDays, totalWorkouts }, { merge: true }).catch(() => {});
        }
      }
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  };

  // NEW: pull today's workout(s) from the `workouts` collection (same one
  // WorkoutScreen writes to via addDoc(collection(db, 'workouts'), ...)).
  const loadSummary = useCallback(async () => {
    if (!user) return;
    try {
      setSummaryLoading(true);
      const summary = await loadTodaySummary(user.uid, today);
      setTodaySummary(summary);
    } catch (e) {
      console.warn('Failed to load today summary:', e);
      setTodaySummary(EMPTY_SUMMARY);
    } finally {
      setSummaryLoading(false);
    }
  }, [user, today]);

  const toggleToday = async () => {
    if (!user) return;
    const key = toDateKey(today);
    const next = !workoutDays[key];
    const updatedDays = { ...workoutDays, [key]: next };
    const { streakDays, totalWorkouts } = computeStreakAndTotal(updatedDays, today);
    setWorkoutDays(updatedDays);
    setSaving(true);
    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, { workoutDays: { [key]: next }, streak: streakDays, totalWorkouts, updatedAt: serverTimestamp() }, { merge: true });
    } catch {
      setWorkoutDays(prev => ({ ...prev, [key]: !next }));
    } finally { setSaving(false); }
  };

  const stats = useMemo(() => {
    const { streakDays, totalWorkouts } = computeStreakAndTotal(workoutDays, today);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    let thisWeek = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart.getTime() + i * ONE_DAY_MS);
      if (d <= today && workoutDays[toDateKey(d)]) thisWeek += 1;
    }
    return { totalWorkouts, streakDays, thisWeek };
  }, [workoutDays, today]);

  const weekDays = useMemo(() => buildWeekStrip(today), [today]);
  const monthWeeks = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const firstName = (displayName || user?.email || 'there').split(' ')[0];
  const todayDone = !!workoutDays[toDateKey(today)];
  const todayLabel = `${WEEKDAY_FULL[today.getDay()]}, ${MONTH_SHORT[today.getMonth()]} ${today.getDate()}`;

  // Avatar: show photo if available, otherwise show initial
  const renderAvatar = () => {
    if (photoURL) {
      return (
        <Image
          source={{ uri: photoURL }}
          style={styles.avatarImage}
          resizeMode="cover"
        />
      );
    }
    return (
      <LinearGradient colors={['#8B5CF6', '#6D28D9']} style={styles.avatarGrad}>
        <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
      </LinearGradient>
    );
  };

  // NEW: navigate to the Workout page with a section param; WorkoutScreen
  // reads `params.section` and scrolls to the matching part of the screen.
  const goToWorkoutSection = useCallback((section: string) => {
    router.push({ pathname: '/workout', params: { section } });
  }, [router]);

  const goToWorkoutAll = useCallback(() => {
    router.push('/workout');
  }, [router]);

  // NEW: build the card definitions from the live summary (memoized so the
  // grid doesn't re-render unless the underlying numbers change).
  const summaryCards: SummaryCardDef[] = useMemo(() => {
    const s = todaySummary;
    return [
      {
        key: 'exercises',
        icon: 'barbell-outline',
        label: 'Exercises',
        value: String(s.totalExercises),
        progress: s.goalExercises ? s.totalExercises / s.goalExercises : 0,
        progressLabel: `${s.totalExercises} / ${s.goalExercises}`,
        color: '#7C3AED',
        bg: '#EDE9FE',
        section: 'exercises',
      },
      {
        key: 'sets',
        icon: 'checkmark-circle-outline',
        label: 'Sets Done',
        value: String(s.totalSets),
        progress: s.goalSets ? s.totalSets / s.goalSets : 0,
        progressLabel: `${s.totalSets} / ${s.goalSets}`,
        color: '#059669',
        bg: '#D1FAE5',
        section: 'sets',
      },
      {
        key: 'volume',
        icon: 'fitness-outline',
        label: 'Volume',
        value: s.totalVolume > 0 ? `${s.totalVolume.toLocaleString()} kg` : '—',
        progress: s.goalVolume ? s.totalVolume / s.goalVolume : 0,
        progressLabel: `${s.totalVolume.toLocaleString()} / ${s.goalVolume.toLocaleString()}`,
        color: '#D97706',
        bg: '#FEF3C7',
        section: 'statistics',
      },
      {
        key: 'duration',
        icon: 'time-outline',
        label: 'Duration',
        value: s.totalDurationSeconds > 0 ? formatDuration(s.totalDurationSeconds) : '—',
        progress: s.goalDurationSeconds ? s.totalDurationSeconds / s.goalDurationSeconds : 0,
        progressLabel: `${Math.round(s.totalDurationSeconds / 60)} / ${Math.round(s.goalDurationSeconds / 60)} min`,
        color: '#0284C7',
        bg: '#E0F2FE',
        section: 'session',
      },
      {
        key: 'calories',
        icon: 'flame-outline',
        label: 'Calories',
        value: s.estimatedCalories > 0 ? `~${s.estimatedCalories}` : '—',
        progress: s.estimatedCalories ? s.estimatedCalories / 600 : 0,
        progressLabel: 'Estimated',
        color: '#DC2626',
        bg: '#FEE2E2',
        section: 'statistics',
      },
      {
        key: 'muscles',
        icon: 'body-outline',
        label: 'Muscle Groups',
        value: s.muscleGroups.length > 0 ? String(s.muscleGroups.length) : '—',
        progress: s.muscleGroups.length ? Math.min(s.muscleGroups.length / 6, 1) : 0,
        progressLabel: s.muscleGroups.length ? s.muscleGroups.slice(0, 3).join(', ') : 'None yet',
        color: '#9333EA',
        bg: '#F3E8FF',
        section: 'muscles',
      },
    ];
  }, [todaySummary]);

  // First three exercise thumbnails (+N more), reused from WorkoutScreen's
  // own exercise library/Cloudinary URLs — no new image source introduced.
  const thumbnailItems = useMemo(() => {
    const uniqueNames = Array.from(new Set(todaySummary.exerciseNames));
    const libItems = uniqueNames
      .map(name => EXERCISE_LIBRARY.find(e => e.name === name))
      .filter((e): e is typeof EXERCISE_LIBRARY[number] => !!e);
    return {
      shown: libItems.slice(0, 3),
      extra: Math.max(libItems.length - 3, 0),
    };
  }, [todaySummary.exerciseNames]);

  return (
    // edges={[]} lets LinearGradient hero extend into the status bar area naturally;
    // we add manual top padding inside the hero instead so content clears the status bar.
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── HERO HEADER ── */}
        <LinearGradient colors={['#1a0533', '#2d1060', '#3b0f8f']} style={styles.hero}>
          {/* Top row */}
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroGreeting}>{getGreeting()},</Text>
              <Text style={styles.heroName}>{firstName} 👋</Text>
            </View>
            {/* Avatar — tappable, navigates to profile */}
            <TouchableOpacity
              style={styles.avatarCircle}
              onPress={() => router.push('/profile')}
              activeOpacity={0.75}
            >
              {renderAvatar()}
            </TouchableOpacity>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={[styles.statPill, { marginRight: 10 }]}>
              <Text style={styles.statBig}>{stats.totalWorkouts}</Text>
              <Text style={styles.statSub}>Total Days</Text>
            </View>
            <View style={[styles.statPill, { marginRight: 10 }]}>
              <Text style={styles.statBig}>{stats.thisWeek}<Text style={styles.statBigSub}>/7</Text></Text>
              <Text style={styles.statSub}>This Week</Text>
            </View>
            {/* Streak pill — highlighted */}
            <View style={[styles.statPill, styles.statPillGold]}>
              <Text style={[styles.statBig, styles.statBigGold]}>{stats.streakDays} 🔥</Text>
              <Text style={[styles.statSub, styles.statSubGold]}>Day Streak</Text>
            </View>
          </View>

          {/* Date tag */}
          <View style={styles.dateBadge}>
            <View style={styles.dateDot} />
            <Text style={styles.dateText}>{todayLabel}</Text>
          </View>
        </LinearGradient>

        {/* ── WEEKLY STRIP ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>This Week</Text>
            <TouchableOpacity onPress={() => setShowFullCalendar(v => !v)} activeOpacity={0.7}>
              <Text style={styles.sectionLink}>{showFullCalendar ? 'Hide' : 'Full calendar'} ›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekStrip}>
            {weekDays.map((day, i) => {
              const key = toDateKey(day);
              const done = !!workoutDays[key];
              const isToday = isSameDay(day, today);
              const isFuture = day > today;
              return (
                <TouchableOpacity
                  key={i}
                  disabled={!isToday}
                  onPress={toggleToday}
                  activeOpacity={0.7}
                  style={styles.weekDayCol}
                >
                  <Text style={[styles.weekDayLabel, isToday && styles.weekDayLabelToday]}>
                    {WEEKDAY_LABELS[day.getDay()]}
                  </Text>
                  <View style={[
                    styles.weekDayBubble,
                    done && styles.weekDayBubbleDone,
                    isToday && !done && styles.weekDayBubbleToday,
                    isFuture && styles.weekDayBubbleFuture,
                  ]}>
                    {isToday && saving
                      ? <ActivityIndicator size="small" color={done ? '#fff' : '#7C3AED'} />
                      : <Text style={[
                          styles.weekDayNum,
                          done && styles.weekDayNumDone,
                          isToday && !done && styles.weekDayNumToday,
                          isFuture && styles.weekDayNumFuture,
                        ]}>{day.getDate()}</Text>
                    }
                  </View>
                  {done && <View style={styles.weekDot} />}
                  {isToday && !done && <View style={[styles.weekDot, styles.weekDotEmpty]} />}
                  {(!done && !isToday) && <View style={styles.weekDotInvisible} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Today toggle */}
          <TouchableOpacity
            style={[styles.todayToggle, todayDone && styles.todayToggleDone]}
            onPress={toggleToday}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator size="small" color={todayDone ? '#6D28D9' : '#fff'} />
              : <>
                  <Text style={[styles.todayToggleIcon, todayDone && styles.todayToggleIconDone]}>
                    {todayDone ? '✓' : '○'}
                  </Text>
                  <Text style={[styles.todayToggleText, todayDone && styles.todayToggleTextDone]}>
                    {todayDone ? "Today's workout logged!" : 'Mark today as a workout day'}
                  </Text>
                </>
            }
          </TouchableOpacity>
        </View>

        {/* ── FULL CALENDAR (collapsible) ── */}
        {showFullCalendar && (
          <View style={styles.section}>
            <View style={styles.calNavRow}>
              <TouchableOpacity onPress={goToPrevMonth} style={styles.navBtn}>
                <Text style={styles.navBtnText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.calMonthTitle}>
                {MONTH_LABELS[viewMonth]} {viewYear}
                {loading && '  '}
                {loading && <ActivityIndicator size="small" color="#7C3AED" />}
              </Text>
              <TouchableOpacity onPress={goToNextMonth} style={styles.navBtn}>
                <Text style={styles.navBtnText}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.calWeekdayRow}>
              {WEEKDAY_LABELS.map((l, i) => (
                <View key={i} style={styles.calHeaderCell}>
                  <Text style={styles.calHeaderText}>{l}</Text>
                </View>
              ))}
            </View>
            {monthWeeks.map((week, wi) => (
              <View key={wi} style={styles.calWeekRow}>
                {week.map((day, di) => {
                  if (!day) return <View key={di} style={styles.calCell} />;
                  const key = toDateKey(day);
                  const done = !!workoutDays[key];
                  const isToday = isSameDay(day, today);
                  const isFuture = day > today;
                  return (
                    <TouchableOpacity
                      key={di}
                      disabled={!isToday}
                      onPress={toggleToday}
                      activeOpacity={0.7}
                      style={[
                        styles.calCell,
                        done && styles.calCellDone,
                        isToday && !done && styles.calCellToday,
                        isFuture && styles.calCellFuture,
                      ]}
                    >
                      {isToday && saving
                        ? <ActivityIndicator size="small" color={done ? '#fff' : '#7C3AED'} />
                        : <Text style={[
                            styles.calDayNum,
                            done && styles.calDayNumDone,
                            isToday && !done && styles.calDayNumToday,
                            isFuture && styles.calDayNumFuture,
                          ]}>{day.getDate()}</Text>
                      }
                      {done && <Text style={styles.calCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {/* ── TODAY'S SUMMARY (rebuilt, data-driven) ── */}
        <View style={[styles.section, summaryStyles.sectionOverride]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Summary</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={goToWorkoutAll}
              accessibilityRole="button"
              accessibilityLabel="View all in Workout"
            >
              <Text style={styles.sectionLink}>View all ›</Text>
            </TouchableOpacity>
          </View>

          {summaryLoading ? (
            <View style={summaryStyles.grid}>
              {[0, 1, 2, 3].map(i => <SummarySkeletonCard key={i} />)}
            </View>
          ) : !todaySummary.hasWorkout ? (
            <View style={summaryStyles.emptyState}>
              <Ionicons name="barbell-outline" size={32} color="#C4B5FD" />
              <Text style={summaryStyles.emptyTitle}>No workout yet today</Text>
              <Text style={summaryStyles.emptySubtitle}>Start your first workout</Text>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => router.push('/workout')}
                accessibilityRole="button"
                accessibilityLabel="Start Workout"
              >
                <LinearGradient
                  colors={['#7C3AED', '#5B21B6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={summaryStyles.emptyCta}
                >
                  <Ionicons name="play" size={13} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={summaryStyles.emptyCtaText}>Start Workout</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Session time range */}
              <View style={summaryStyles.timeRow}>
                <View style={summaryStyles.timeChip}>
                  <Ionicons name="play-outline" size={12} color="#7C3AED" />
                  <Text style={summaryStyles.timeChipText}>
                    Started {formatClock(todaySummary.startedAt)}
                  </Text>
                </View>
                <View style={summaryStyles.timeChip}>
                  <Ionicons name="flag-outline" size={12} color="#059669" />
                  <Text style={summaryStyles.timeChipText}>
                    Finished {formatClock(todaySummary.finishedAt)}
                  </Text>
                </View>
              </View>

              {/* Exercise thumbnails */}
              {thumbnailItems.shown.length > 0 && (
                <View style={summaryStyles.thumbRow}>
                  {thumbnailItems.shown.map((item, i) => (
                    <View
                      key={item.id}
                      style={[summaryStyles.thumbCircle, i > 0 && { marginLeft: -10 }]}
                    >
                      <ThumbnailFade uri={item.thumbnail} />
                    </View>
                  ))}
                  {thumbnailItems.extra > 0 && (
                    <View style={[summaryStyles.thumbCircle, summaryStyles.thumbExtra, { marginLeft: -10 }]}>
                      <Text style={summaryStyles.thumbExtraText}>+{thumbnailItems.extra}</Text>
                    </View>
                  )}
                  <Text style={summaryStyles.thumbCaption}>
                    {todaySummary.totalReps} total reps today
                  </Text>
                </View>
              )}

              {/* 2-column responsive grid of summary cards */}
              <View style={summaryStyles.grid}>
                {summaryCards.map((def, i) => (
                  <SummaryCard key={def.key} def={def} index={i} onPress={goToWorkoutSection} />
                ))}
              </View>
            </>
          )}
        </View>

        {/* ── START WORKOUT CTA ── */}
        <Animated.View style={[styles.ctaWrap, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity activeOpacity={0.88} onPress={() => router.push('/workout')}>
            <LinearGradient colors={['#7C3AED', '#5B21B6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtn}>
              <Text style={styles.ctaIcon}>▶</Text>
              <Text style={styles.ctaText}>Start Workout</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── CELL SIZE for calendar ───
const CELL_SIZE = Math.floor((width - 32 - 32 - 6 * 6) / 7);
const BUBBLE = Math.floor((width - 32 - 16 - 6 * 12) / 7);

// Status bar height for manual top padding inside the hero
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 50;

// Card width for the 2-column responsive summary grid (matches the
// WorkoutScreen card gap/padding language: 16px outer gutter, 12px gap).
const SUMMARY_CARD_GAP = 12;
const SUMMARY_CARD_WIDTH = (width - 32 - 32 - SUMMARY_CARD_GAP) / 2;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F4F8' },
  scroll: { paddingBottom: 20 },

  // ── Hero ──
  hero: {
    paddingHorizontal: 20,
    // Push content below the status bar
    paddingTop: STATUS_BAR_HEIGHT + 12,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 20,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroGreeting: { fontSize: 14, color: 'rgba(196,181,253,0.85)', fontWeight: '500' },
  heroName: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 1 },

  // Avatar — circle container sized 48×48
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    // subtle ring so it pops against the dark gradient
    borderWidth: 2,
    borderColor: 'rgba(139,92,246,0.6)',
  },
  // Photo fills the circle when available
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  // Fallback gradient + initial
  avatarGrad: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },

  statsRow: { flexDirection: 'row', marginBottom: 16 },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  statPillGold: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  statBig: { fontSize: 22, fontWeight: '900', color: '#fff' },
  statBigSub: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.55)' },
  statBigGold: { color: '#FCD34D' },
  statSub: { fontSize: 11, color: 'rgba(196,181,253,0.8)', marginTop: 3 },
  statSubGold: { color: 'rgba(252,211,77,0.85)' },

  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#86EFAC', marginRight: 7 },
  dateText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },

  // ── Section ──
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#6D28D9',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  sectionLink: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },

  // ── Week Strip ──
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  weekDayCol: { alignItems: 'center', flex: 1 },
  weekDayLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 6 },
  weekDayLabelToday: { color: '#7C3AED' },
  weekDayBubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekDayBubbleDone: { backgroundColor: '#7C3AED' },
  weekDayBubbleToday: {
    borderWidth: 2,
    borderColor: '#7C3AED',
    backgroundColor: 'rgba(124,58,237,0.07)',
  },
  weekDayBubbleFuture: { opacity: 0.4 },
  weekDayNum: { fontSize: 13, fontWeight: '700', color: '#374151' },
  weekDayNumDone: { color: '#fff' },
  weekDayNumToday: { color: '#7C3AED', fontWeight: '800' },
  weekDayNumFuture: { color: '#9CA3AF' },
  weekDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#7C3AED', marginTop: 5 },
  weekDotEmpty: { backgroundColor: '#C4B5FD' },
  weekDotInvisible: { width: 4, height: 4, marginTop: 5 },

  // Today toggle
  todayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  todayToggleDone: { backgroundColor: '#EDE9FE' },
  todayToggleIcon: { fontSize: 16, color: '#fff', marginRight: 8 },
  todayToggleIconDone: { color: '#7C3AED' },
  todayToggleText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  todayToggleTextDone: { color: '#7C3AED' },

  // ── Full Calendar ──
  calNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  navBtnText: { fontSize: 18, color: '#1a1a2e', fontWeight: '700' },
  calMonthTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  calWeekdayRow: { flexDirection: 'row', marginBottom: 6 },
  calHeaderCell: { width: CELL_SIZE, alignItems: 'center' },
  calHeaderText: { fontSize: 11, fontWeight: '700', color: '#9CA3AF' },
  calWeekRow: { flexDirection: 'row', marginBottom: 6 },
  calCell: {
    width: CELL_SIZE, height: CELL_SIZE,
    borderRadius: CELL_SIZE / 4,
    justifyContent: 'center', alignItems: 'center',
  },
  calCellDone: { backgroundColor: '#7C3AED' },
  calCellToday: {
    borderWidth: 2, borderColor: '#7C3AED',
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  calCellFuture: { opacity: 0.4 },
  calDayNum: { fontSize: 12, fontWeight: '600', color: '#374151' },
  calDayNumDone: { color: '#fff', fontWeight: '700' },
  calDayNumToday: { color: '#7C3AED', fontWeight: '800' },
  calDayNumFuture: { color: '#9CA3AF' },
  calCheck: {
    position: 'absolute', bottom: 1, right: 3,
    fontSize: 8, color: '#fff', fontWeight: '900',
  },

  // ── CTA ──
  ctaWrap: { marginHorizontal: 16, marginTop: 6 },
  ctaBtn: {
    borderRadius: 16, paddingVertical: 17,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  ctaIcon: { color: '#fff', fontSize: 14, marginRight: 10 },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.4 },
});

// ─────────────────────────────────────────────
// Today's Summary styles — intentionally mirrors WorkoutScreen's design
// language: same border radius (16–20), same hairline borders, same
// F2F2F7/white card surfaces, same chip/typography scale, same shadow.
// ─────────────────────────────────────────────
const summaryStyles = StyleSheet.create({
  sectionOverride: { paddingBottom: 18 },

  timeRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  timeChipText: { fontSize: 11, fontWeight: '600', color: '#374151' },

  thumbRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  thumbCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#E5E5EA',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbExtra: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#7C3AED' },
  thumbExtraText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  thumbCaption: { marginLeft: 10, fontSize: 12, color: '#6B7280', fontWeight: '600' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cardWrap: {
    width: SUMMARY_CARD_WIDTH,
    marginBottom: SUMMARY_CARD_GAP,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 2 },
  cardValue: { fontSize: 19, fontWeight: '800', color: '#1a1a2e', marginBottom: 10 },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#F2F2F7',
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginBottom: 8 },
  tapRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  tapText: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },

  skelCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E5E5EA', marginBottom: 10 },
  skelLine: { height: 11, borderRadius: 4, backgroundColor: '#E5E5EA' },

  emptyState: { alignItems: 'center', paddingVertical: 18 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a2e', marginTop: 10 },
  emptySubtitle: { fontSize: 12, color: '#9CA3AF', fontWeight: '500', marginTop: 2, marginBottom: 14 },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  emptyCtaText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
});