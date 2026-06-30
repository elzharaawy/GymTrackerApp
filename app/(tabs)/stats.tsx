import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Polyline, Circle, Path, G, Text as SvgText } from 'react-native-svg';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  Layout,
} from 'react-native-reanimated';
import { auth, db } from '../../firebaseConfig';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  Timestamp,
} from 'firebase/firestore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 32 - 32 - 36; // section padding (16*2) + card padding (16*2) + y-axis gutter
const SPARK_WIDTH = (width - 32 - 12) / 2 - 32; // half-width card minus padding

// Status bar height, matched to HomeScreen's hero padding logic
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 50;

// =====================================================
// Types matching what workout.tsx saves — UNCHANGED
// =====================================================
interface SetData {
  weight: string;
  reps: string;
}
interface ExerciseData {
  name: string;
  muscle: string;
  sets: SetData[];
}
interface WorkoutDoc {
  id: string;
  userId: string;
  duration: number; // seconds
  volume: number;
  exercises: ExerciseData[];
  muscles: string[];
  createdAt: Timestamp | null;
}

// Best-effort profile shape. Every field is optional — if your `users`
// collection uses different field names, nothing here breaks, the hero
// just falls back to defaults. Tell me the real schema and I'll tighten
// this up in Phase 2.
interface UserProfile {
  displayName?: string;
  name?: string;
  weight?: number;
  height?: number;
  age?: number;
  gender?: string;
}

const timeFilters: { id: string; label: string; days: number | null }[] = [
  { id: 'today', label: 'Today', days: 1 },
  { id: '1w', label: 'Week', days: 7 },
  { id: '1m', label: 'Month', days: 30 },
  { id: '3m', label: '3m', days: 90 },
  { id: '6m', label: '6m', days: 180 },
  { id: '1y', label: 'Year', days: 365 },
  { id: 'all', label: 'All', days: null },
];

// Maps the `section` param HomeScreen passes (from each Today's Summary
// card) to the anchor inside this screen it should scroll to. UNCHANGED.
type SectionKey = 'summary' | 'weekly' | 'muscleVolume' | 'exerciseTable';
const SECTION_PARAM_MAP: Record<string, SectionKey> = {
  exercises: 'exerciseTable',
  sets: 'exerciseTable',
  statistics: 'weekly',
  volume: 'muscleVolume',
  muscles: 'muscleVolume',
  session: 'summary',
  duration: 'summary',
  calories: 'summary',
};

const PURPLE_GRADIENT: [string, string, string] = ['#1a0533', '#2d1060', '#3b0f8f'];
const CARD_GRADIENTS: [string, string][] = [
  ['#7C3AED', '#A855F7'],
  ['#D97706', '#F59E0B'],
  ['#0284C7', '#38BDF8'],
  ['#DC2626', '#F87171'],
  ['#059669', '#34D399'],
  ['#9333EA', '#C084FC'],
];

// =====================================================
// Small SVG building blocks
// =====================================================
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const h = 28;
  const w = SPARK_WIDTH;
  if (data.length < 2 || data.every((v) => v === 0)) {
    return <View style={{ height: h }} />;
  }
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(' ');
  const lastX = (data.length - 1) * step;
  const lastY = h - ((data[data.length - 1] - min) / range) * h;
  return (
    <Svg width={w} height={h}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={lastX} cy={lastY} r={3} fill={color} />
    </Svg>
  );
}

function MuscleSvgPie({ data }: { data: { label: string; value: number; color: string }[] }) {
  const size = 150;
  const r = 60;
  const cx = size / 2;
  const cy = size / 2;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  let angleStart = -90;
  const slices = data.map((d) => {
    const angle = (d.value / total) * 360;
    const angleEnd = angleStart + angle;
    const largeArc = angle > 180 ? 1 : 0;
    const x1 = cx + r * Math.cos((Math.PI * angleStart) / 180);
    const y1 = cy + r * Math.sin((Math.PI * angleStart) / 180);
    const x2 = cx + r * Math.cos((Math.PI * angleEnd) / 180);
    const y2 = cy + r * Math.sin((Math.PI * angleEnd) / 180);
    const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`;
    angleStart = angleEnd;
    return { path, color: d.color };
  });

  return (
    <Svg width={size} height={size}>
      {slices.map((s, i) => (
        <Path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={2} />
      ))}
      <Circle cx={cx} cy={cy} r={32} fill="#fff" />
    </Svg>
  );
}

function AnimatedBarChart({
  data,
  maxValue,
  color = '#7C3AED',
  height = 120,
}: {
  data: { label: string; value: number }[];
  maxValue: number;
  color?: string;
  height?: number;
}) {
  const safeMax = maxValue || 1;
  const maxBarWidth = 56;
  const rawWidth = Math.floor(CHART_WIDTH / Math.max(data.length, 1)) - 8;
  const barWidth = Math.min(maxBarWidth, Math.max(rawWidth, 6));

  return (
    <View style={{ width: CHART_WIDTH }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          height,
          gap: 4,
          justifyContent: data.length <= 3 ? 'flex-start' : 'space-between',
        }}
      >
        {data.map((d, i) => {
          const barH = Math.max(4, (d.value / safeMax) * height);
          return (
            <Animated.View
              key={i}
              entering={FadeInUp.delay(i * 40).springify()}
              style={{
                width: data.length <= 3 ? barWidth + 24 : undefined,
                flex: data.length <= 3 ? undefined : 1,
                alignItems: 'center',
                justifyContent: 'flex-end',
                height,
              }}
            >
              <View
                style={{
                  width: barWidth,
                  height: barH,
                  backgroundColor: color,
                  borderRadius: 6,
                }}
              />
            </Animated.View>
          );
        })}
      </View>
      <View
        style={{
          flexDirection: 'row',
          marginTop: 6,
          gap: 4,
          justifyContent: data.length <= 3 ? 'flex-start' : 'space-between',
        }}
      >
        {data.map((d, i) => (
          <View
            key={i}
            style={{
              width: data.length <= 3 ? barWidth + 24 : undefined,
              flex: data.length <= 3 ? undefined : 1,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 9, color: '#9CA3AF', textAlign: 'center' }} numberOfLines={1}>
              {d.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function YAxis({ max, steps = 4, formatK = false }: { max: number; steps?: number; formatK?: boolean }) {
  const safeMax = max || steps;
  const labels = Array.from({ length: steps + 1 }, (_, i) =>
    Math.round((safeMax / steps) * (steps - i))
  );
  return (
    <View style={{ justifyContent: 'space-between', height: 120, paddingRight: 4 }}>
      {labels.map((l, i) => (
        <Text key={i} style={{ fontSize: 9, color: '#9CA3AF', textAlign: 'right' }}>
          {formatK && l >= 1000 ? `${(l / 1000).toFixed(0)}k` : l}
        </Text>
      ))}
    </View>
  );
}

export default function StatsScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const router = useRouter();
  const [workouts, setWorkouts] = useState<WorkoutDoc[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState('3m');
  const [muscleFilter, setMuscleFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // --- Live query: only this user's workouts — UNCHANGED ---
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      setError('Please log in to view your stats.');
      return;
    }

    const q = query(
      collection(db, 'workouts'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: WorkoutDoc[] = snapshot.docs
          .map((d) => {
            const dd = d.data();
            return {
              id: d.id,
              userId: dd.userId,
              duration: dd.duration || 0,
              volume: dd.volume || 0,
              exercises: dd.exercises || [],
              muscles: dd.muscles || [],
              createdAt: dd.createdAt || null,
            };
          })
          .sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
          });
        setWorkouts(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn('Stats query failed:', err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // --- Optional profile doc for greeting. Soft-fails if missing/absent. ---
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) setProfile(snap.data() as UserProfile);
      },
      () => {
        // No users/{uid} doc, or no read access — fall back silently.
        setProfile(null);
      }
    );
    return () => unsub();
  }, []);

  // --- Filter by time range — UNCHANGED ---
  const activeFilter = timeFilters.find((f) => f.id === timeFilter)!;
  const filteredWorkouts = useMemo(() => {
    if (!activeFilter.days) return workouts;
    const cutoff = Date.now() - activeFilter.days * 24 * 60 * 60 * 1000;
    return workouts.filter((w) => {
      const ts = w.createdAt?.toMillis ? w.createdAt.toMillis() : 0;
      return ts >= cutoff;
    });
  }, [workouts, timeFilter]);

  // --- Available muscles from actual data — UNCHANGED ---
  const availableMuscles = useMemo(() => {
    const set = new Set<string>();
    workouts.forEach((w) => w.muscles.forEach((m) => set.add(m)));
    return ['all', ...Array.from(set).sort()];
  }, [workouts]);

  // --- Summary stats — UNCHANGED + extended ---
  const summary = useMemo(() => {
    const totalWorkouts = filteredWorkouts.length;
    const totalVolume = filteredWorkouts.reduce((s, w) => s + w.volume, 0);
    const totalDuration = filteredWorkouts.reduce((s, w) => s + w.duration, 0);
    const avgDurationSec = totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0;
    // Rough calorie estimate: ~5.5 kcal/min of training (placeholder until
    // we have a real MET/weight-based formula from your profile in Phase 2)
    const estCalories = Math.round((totalDuration / 60) * 5.5);

    const weekSet = new Set<string>();
    filteredWorkouts.forEach((w) => {
      if (w.createdAt?.toDate) {
        const d = w.createdAt.toDate();
        const weekKey = `${d.getFullYear()}-W${getWeekNumber(d)}`;
        weekSet.add(weekKey);
      }
    });

    return {
      totalWorkouts,
      totalVolume,
      avgDurationSec,
      activeWeeks: weekSet.size,
      estCalories,
    };
  }, [filteredWorkouts]);

  // --- Streak (based on ALL workouts, not time-filtered) ---
  const { currentStreak, longestStreak } = useMemo(() => calcStreaks(workouts), [workouts]);

  // --- Level / rank, purely a function of total lifetime workouts ---
  const level = Math.max(1, Math.floor(workouts.length / 5) + 1);
  const rank = rankForLevel(level);

  // --- Month-over-month % changes for overview cards ---
  const monthCompare = useMemo(() => buildMonthCompare(workouts), [workouts]);

  // --- Last 8 weekly buckets, used for sparklines on overview cards ---
  const sparkWeeks = useMemo(() => buildWeeklyBuckets(workouts, 8, 'count'), [workouts]);
  const sparkVolume = useMemo(() => buildWeeklyBuckets(workouts, 8, 'volume'), [workouts]);
  const sparkDuration = useMemo(() => buildWeeklyBuckets(workouts, 8, 'duration'), [workouts]);

  // --- Workouts per week (last 6 buckets) — UNCHANGED ---
  const workoutsPerWeek = useMemo(() => buildWeeklyBuckets(filteredWorkouts, 6, 'count'), [filteredWorkouts]);

  // --- Volume by week (last 6 buckets) — UNCHANGED ---
  const volumeByWeek = useMemo(() => buildWeeklyBuckets(filteredWorkouts, 6, 'volume'), [filteredWorkouts]);

  // --- Volume by muscle — UNCHANGED ---
  const volumeByMuscle = useMemo(() => {
    const map: Record<string, number> = {};
    filteredWorkouts.forEach((w) => {
      w.exercises.forEach((ex) => {
        const exVolume = ex.sets.reduce((s, set) => {
          const wt = parseFloat(set.weight) || 0;
          const rp = parseFloat(set.reps) || 0;
          return s + wt * rp;
        }, 0);
        map[ex.muscle] = (map[ex.muscle] || 0) + exVolume;
      });
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredWorkouts]);

  const muscleColors = ['#7C3AED', '#D97706', '#0284C7', '#DC2626', '#059669', '#9333EA', '#EA580C', '#0891B2'];
  const muscleSlices = volumeByMuscle.map((m, i) => ({ ...m, color: muscleColors[i % muscleColors.length] }));

  // --- Personal Records, computed entirely from existing exercise/set data ---
  const personalRecords = useMemo(() => calcPersonalRecords(workouts), [workouts]);

  // --- Exercise breakdown table — UNCHANGED ---
  const exerciseTable = useMemo(() => {
    const map: Record<
      string,
      { name: string; bestSet: string; bestVolume: number; totalReps: number; totalVolume: number; sets: number }
    > = {};

    filteredWorkouts.forEach((w) => {
      w.exercises.forEach((ex) => {
        if (muscleFilter !== 'all' && ex.muscle !== muscleFilter) return;
        if (!map[ex.name]) {
          map[ex.name] = { name: ex.name, bestSet: '—', bestVolume: 0, totalReps: 0, totalVolume: 0, sets: 0 };
        }
        ex.sets.forEach((set) => {
          const wt = parseFloat(set.weight) || 0;
          const rp = parseFloat(set.reps) || 0;
          const vol = wt * rp;
          map[ex.name].sets += 1;
          map[ex.name].totalReps += rp;
          map[ex.name].totalVolume += vol;
          if (vol > map[ex.name].bestVolume) {
            map[ex.name].bestVolume = vol;
            map[ex.name].bestSet = `${set.weight || 0} lb x ${set.reps || 0}`;
          }
        });
      });
    });

    return Object.values(map).sort((a, b) => b.totalVolume - a.totalVolume);
  }, [filteredWorkouts, muscleFilter]);

  const maxWeeklyCount = Math.max(...workoutsPerWeek.map((d) => d.value), 1);
  const maxWeeklyVolume = Math.max(...volumeByWeek.map((d) => d.value), 1);
  const maxMuscleVolume = Math.max(...volumeByMuscle.map((d) => d.value), 1);

  // --- Scroll-to-section wiring — UNCHANGED ---
  const scrollRef = useRef<ScrollView>(null);
  const anchorY = useRef<Record<SectionKey, number>>({
    summary: 0,
    weekly: 0,
    muscleVolume: 0,
    exerciseTable: 0,
  });

  const registerAnchor = useCallback((key: SectionKey) => (e: any) => {
    anchorY.current[key] = e.nativeEvent.layout.y;
  }, []);

  useEffect(() => {
    const raw = Array.isArray(params.section) ? params.section[0] : params.section;
    if (!raw || loading) return;
    const target = SECTION_PARAM_MAP[raw];
    if (!target) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(anchorY.current[target] - 12, 0), animated: true });
    }, 250);
    return () => clearTimeout(t);
  }, [params.section, loading, filteredWorkouts.length]);

  const onSelectFilter = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTimeFilter(id);
  };

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((cur) => (cur === id ? null : id));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Loading your stats…</Text>
      </SafeAreaView>
    );
  }

  const greetingName = profile?.displayName || profile?.name || auth.currentUser?.displayName || 'Athlete';

  const overviewCards = [
    {
      icon: 'barbell-outline' as const,
      label: 'Total Workouts',
      value: String(summary.totalWorkouts),
      pct: monthCompare.workoutsPct,
      spark: sparkWeeks.map((d) => d.value),
    },
    {
      icon: 'fitness-outline' as const,
      label: 'Total Volume',
      value: formatVolume(summary.totalVolume),
      pct: monthCompare.volumePct,
      spark: sparkVolume.map((d) => d.value),
    },
    {
      icon: 'time-outline' as const,
      label: 'Avg Workout Time',
      value: formatDuration(summary.avgDurationSec),
      pct: monthCompare.durationPct,
      spark: sparkDuration.map((d) => d.value),
    },
    {
      icon: 'flame-outline' as const,
      label: 'Calories Burned',
      value: `${summary.estCalories.toLocaleString()} kcal`,
      pct: monthCompare.volumePct,
      spark: sparkVolume.map((d) => d.value * 0.01),
    },
    {
      icon: 'trending-up-outline' as const,
      label: 'Current Streak',
      value: `${currentStreak} day${currentStreak === 1 ? '' : 's'}`,
      pct: null,
      spark: sparkWeeks.map((d) => d.value),
    },
    {
      icon: 'trophy-outline' as const,
      label: 'Longest Streak',
      value: `${longestStreak} day${longestStreak === 1 ? '' : 's'}`,
      pct: null,
      spark: sparkWeeks.map((d) => d.value),
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── HERO ── */}
        <LinearGradient colors={PURPLE_GRADIENT} style={styles.hero}>
          <Animated.View entering={FadeInDown.duration(400)}>
            <Text style={styles.heroEyebrow}>Welcome back, {greetingName}</Text>
            <Text style={styles.heroTitle}>Performance Dashboard</Text>

            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Ionicons name="flame" size={14} color="#FB923C" />
                <Text style={styles.heroBadgeText}>{currentStreak} Day Streak</Text>
              </View>
              <View style={styles.heroBadge}>
                <Ionicons name="star" size={14} color="#FBBF24" />
                <Text style={styles.heroBadgeText}>Level {level}</Text>
              </View>
              <View style={styles.heroBadge}>
                <Ionicons name="ribbon" size={14} color="#34D399" />
                <Text style={styles.heroBadgeText}>{rank}</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={[styles.statPill, { marginRight: 10 }]}>
                <Text style={styles.statBig}>{summary.totalWorkouts}</Text>
                <Text style={styles.statSub}>Workouts</Text>
              </View>
              <View style={[styles.statPill, { marginRight: 10 }]}>
                <Text style={styles.statBig}>{formatVolume(summary.totalVolume)}</Text>
                <Text style={styles.statSub}>Total Volume</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statBig}>{summary.activeWeeks}</Text>
                <Text style={styles.statSub}>Active Weeks</Text>
              </View>
            </View>
          </Animated.View>
        </LinearGradient>

        {error && (
          <View style={[styles.section, styles.errorBanner]}>
            <Ionicons name="alert-circle" size={16} color="#991B1B" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!error && workouts.length === 0 && (
          <View style={[styles.section, styles.emptyState]}>
            <Ionicons name="bar-chart-outline" size={32} color="#C4B5FD" />
            <Text style={styles.emptyTitle}>No workouts yet</Text>
            <Text style={styles.emptySub}>
              Finish a workout from the Workout tab and your stats will show up here.
            </Text>
          </View>
        )}

        {!error && workouts.length > 0 && (
          <>
            {/* Time Filter */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Time range</Text>
              </View>
              <View style={styles.filterBar}>
                {timeFilters.map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.chip, timeFilter === f.id && styles.chipActive]}
                    onPress={() => onSelectFilter(f.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${f.label}`}
                    accessibilityState={{ selected: timeFilter === f.id }}
                  >
                    <Text style={[styles.chipText, timeFilter === f.id && styles.chipTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Overview cards (6) */}
            <View style={styles.section} onLayout={registerAnchor('summary')}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Overview</Text>
              </View>
              <View style={styles.overviewGrid}>
                {overviewCards.map((c, i) => (
                  <Animated.View
                    key={c.label}
                    entering={FadeInUp.delay(i * 60).duration(350)}
                    style={styles.overviewCard}
                  >
                    <LinearGradient
                      colors={CARD_GRADIENTS[i % CARD_GRADIENTS.length]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.overviewIconCircle}
                    >
                      <Ionicons name={c.icon} size={16} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.overviewValue}>{c.value}</Text>
                    <Text style={styles.overviewLabel}>{c.label}</Text>
                    <View style={styles.overviewFooterRow}>
                      <Sparkline
                        data={c.spark}
                        color={CARD_GRADIENTS[i % CARD_GRADIENTS.length][0]}
                      />
                    </View>
                    {c.pct !== null && (
                      <View style={styles.pctRow}>
                        <Ionicons
                          name={c.pct >= 0 ? 'arrow-up' : 'arrow-down'}
                          size={11}
                          color={c.pct >= 0 ? '#059669' : '#DC2626'}
                        />
                        <Text style={[styles.pctText, { color: c.pct >= 0 ? '#059669' : '#DC2626' }]}>
                          {Math.abs(c.pct).toFixed(0)}% vs last month
                        </Text>
                      </View>
                    )}
                  </Animated.View>
                ))}
              </View>
            </View>

            {/* Personal Records */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Personal Records</Text>
                <Ionicons name="trophy" size={18} color="#D97706" />
              </View>
              {personalRecords.length === 0 ? (
                <Text style={styles.noDataText}>Log a few workouts to unlock PRs</Text>
              ) : (
                <View style={styles.prGrid}>
                  {personalRecords.map((pr, i) => (
                    <Animated.View key={pr.label} entering={FadeInUp.delay(i * 50)} style={styles.prCard}>
                      <Ionicons name="trophy" size={16} color="#D97706" />
                      <Text style={styles.prValue}>{pr.value}</Text>
                      <Text style={styles.prLabel}>{pr.label}</Text>
                    </Animated.View>
                  ))}
                </View>
              )}
            </View>

            {/* Weekly Workout Trend */}
            <View style={styles.section} onLayout={registerAnchor('weekly')}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Weekly workout trend</Text>
              </View>
              {workoutsPerWeek.some((d) => d.value > 0) ? (
                <View style={styles.chartRow}>
                  <YAxis max={maxWeeklyCount} steps={Math.min(4, maxWeeklyCount)} />
                  <AnimatedBarChart data={workoutsPerWeek} maxValue={maxWeeklyCount} color="#7C3AED" />
                </View>
              ) : (
                <Text style={styles.noDataText}>Not enough data yet</Text>
              )}
            </View>

            {/* Muscle Distribution Pie */}
            <View style={styles.section} onLayout={registerAnchor('muscleVolume')}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Muscle distribution</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.musclePills}>
                <View style={styles.musclePillRow}>
                  {availableMuscles.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.muscleChip, muscleFilter === m && styles.muscleChipActive]}
                      onPress={() => setMuscleFilter(m)}
                      accessibilityRole="button"
                      accessibilityLabel={`Filter exercises by ${m}`}
                      accessibilityState={{ selected: muscleFilter === m }}
                    >
                      <Text style={[styles.muscleText, muscleFilter === m && styles.muscleTextActive]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {muscleSlices.length > 0 ? (
                <View style={styles.pieRow}>
                  <MuscleSvgPie data={muscleSlices} />
                  <View style={styles.legendCol}>
                    {muscleSlices.map((m) => (
                      <View key={m.label} style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: m.color }]} />
                        <Text style={styles.legendLabel} numberOfLines={1}>{m.label}</Text>
                        <Text style={styles.legendValue}>{formatVolume(m.value)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={styles.noDataText}>Not enough data yet</Text>
              )}

              <View style={[styles.chartRow, { marginTop: 18 }]}>
                <YAxis max={maxMuscleVolume} steps={4} formatK />
                <AnimatedBarChart data={volumeByMuscle} maxValue={maxMuscleVolume} color="#9333EA" />
              </View>
            </View>

            {/* Monthly Volume Trend */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Training volume</Text>
              </View>
              {volumeByWeek.some((d) => d.value > 0) ? (
                <View style={styles.chartRow}>
                  <YAxis max={maxWeeklyVolume} steps={4} formatK />
                  <AnimatedBarChart data={volumeByWeek} maxValue={maxWeeklyVolume} color="#5B21B6" />
                </View>
              ) : (
                <Text style={styles.noDataText}>Not enough data yet</Text>
              )}
            </View>

            {/* Recent Activity Timeline */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent activity</Text>
              </View>
              {filteredWorkouts.slice(0, 10).map((w, i) => {
                const isExpanded = expandedId === w.id;
                const dateStr = w.createdAt?.toDate
                  ? w.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : '—';
                const isPR = personalRecords.some((pr) => pr.workoutId === w.id);
                return (
                  <Animated.View key={w.id} entering={FadeIn.delay(i * 30)} layout={Layout}>
                    <TouchableOpacity style={styles.timelineRow} onPress={() => toggleExpand(w.id)} activeOpacity={0.7}>
                      <View style={styles.timelineDateCol}>
                        <Text style={styles.timelineDate}>{dateStr}</Text>
                        {isPR && <Ionicons name="trophy" size={12} color="#D97706" style={{ marginTop: 2 }} />}
                      </View>
                      <View style={styles.timelineMain}>
                        <Text style={styles.timelineVolume}>{formatVolume(w.volume)} lifted</Text>
                        <Text style={styles.timelineMeta}>
                          {formatDuration(w.duration)} • {w.exercises.length} exercises • {w.muscles.join(', ') || '—'}
                        </Text>
                        {isExpanded && (
                          <View style={styles.timelineExpand}>
                            {w.exercises.map((ex, idx) => (
                              <Text key={idx} style={styles.timelineExerciseLine}>
                                • {ex.name} — {ex.sets.length} sets
                              </Text>
                            ))}
                          </View>
                        )}
                      </View>
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>

            {/* Exercise Breakdown Table — UNCHANGED */}
            <View style={styles.section} onLayout={registerAnchor('exerciseTable')}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your exercises</Text>
              </View>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCol, { flex: 2 }]}>Best set</Text>
                <Text style={styles.tableCol}>Reps</Text>
                <Text style={[styles.tableCol, { textAlign: 'right' }]}>Volume</Text>
              </View>
              {exerciseTable.length === 0 ? (
                <Text style={styles.noDataText}>No exercises in this range</Text>
              ) : (
                exerciseTable.map((ex) => (
                  <View key={ex.name} style={styles.workoutRow}>
                    <View style={styles.workoutRowLeft}>
                      <Text style={styles.workoutRowName} numberOfLines={1}>{ex.name}</Text>
                      <Text style={styles.workoutRowSets}>
                        {ex.bestSet} • {ex.sets} sets
                      </Text>
                    </View>
                    <Text style={styles.workoutRowReps}>{ex.totalReps}</Text>
                    <Text style={styles.workoutRowVolume}>{formatVolume(ex.totalVolume)}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// =====================================================
// Helpers — existing ones unchanged, new ones added below
// =====================================================
function getWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function formatVolume(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k lb`;
  return `${Math.round(v)} lb`;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

function buildWeeklyBuckets(
  workouts: WorkoutDoc[],
  numWeeks: number,
  mode: 'count' | 'volume' | 'duration'
): { label: string; value: number }[] {
  const now = new Date();
  const buckets: { label: string; value: number; start: number; end: number }[] = [];

  for (let i = numWeeks - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(now.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    buckets.push({
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      value: 0,
      start: start.setHours(0, 0, 0, 0),
      end: end.setHours(23, 59, 59, 999),
    });
  }

  workouts.forEach((w) => {
    const ts = w.createdAt?.toMillis ? w.createdAt.toMillis() : null;
    if (!ts) return;
    const bucket = buckets.find((b) => ts >= b.start && ts <= b.end);
    if (bucket) {
      if (mode === 'count') bucket.value += 1;
      else if (mode === 'volume') bucket.value += w.volume;
      else bucket.value += w.duration;
    }
  });

  return buckets.map((b) => ({ label: b.label, value: b.value }));
}

// Consecutive-day streak, computed off calendar days that have at least
// one workout. currentStreak counts back from today/yesterday; longest
// scans the whole history.
function calcStreaks(workouts: WorkoutDoc[]) {
  const days = new Set<string>();
  workouts.forEach((w) => {
    if (w.createdAt?.toDate) {
      const d = w.createdAt.toDate();
      days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  });
  if (days.size === 0) return { currentStreak: 0, longestStreak: 0 };

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  // current streak: walk back from today while each day is present
  let currentStreak = 0;
  const cursor = new Date();
  // allow today to be "not yet logged" without breaking the streak
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(dayKey(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // longest streak: sort all day keys chronologically and scan
  const sortedTimes = Array.from(days)
    .map((k) => {
      const [y, m, d] = k.split('-').map(Number);
      return new Date(y, m, d).getTime();
    })
    .sort((a, b) => a - b);

  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < sortedTimes.length; i++) {
    const diffDays = Math.round((sortedTimes[i] - sortedTimes[i - 1]) / 86400000);
    if (diffDays === 1) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 1;
    }
  }

  return { currentStreak, longestStreak };
}

function rankForLevel(level: number) {
  if (level >= 20) return 'Elite Athlete';
  if (level >= 15) return 'Pro Lifter';
  if (level >= 10) return 'Advanced';
  if (level >= 5) return 'Intermediate';
  return 'Beginner';
}

// This-month vs last-month deltas for the overview cards.
function buildMonthCompare(workouts: WorkoutDoc[]) {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

  let thisWorkouts = 0, lastWorkouts = 0;
  let thisVolume = 0, lastVolume = 0;
  let thisDuration = 0, lastDuration = 0;

  workouts.forEach((w) => {
    const ts = w.createdAt?.toMillis ? w.createdAt.toMillis() : null;
    if (!ts) return;
    if (ts >= startOfThisMonth) {
      thisWorkouts += 1;
      thisVolume += w.volume;
      thisDuration += w.duration;
    } else if (ts >= startOfLastMonth && ts < startOfThisMonth) {
      lastWorkouts += 1;
      lastVolume += w.volume;
      lastDuration += w.duration;
    }
  });

  const pct = (cur: number, prev: number) => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  };

  return {
    workoutsPct: pct(thisWorkouts, lastWorkouts),
    volumePct: pct(thisVolume, lastVolume),
    durationPct: pct(thisDuration, lastDuration),
  };
}

// Personal records, all derived from exercise name matching + set data.
// Matching is intentionally loose (substring, case-insensitive) since
// exercise names are free text in your schema.
function calcPersonalRecords(workouts: WorkoutDoc[]) {
  type Rec = { label: string; value: string; workoutId?: string; weight: number };
  const matchAndFindMax = (keyword: string) => {
    let best = { weight: 0, reps: 0, workoutId: '' };
    workouts.forEach((w) => {
      w.exercises.forEach((ex) => {
        if (!ex.name.toLowerCase().includes(keyword)) return;
        ex.sets.forEach((s) => {
          const wt = parseFloat(s.weight) || 0;
          if (wt > best.weight) {
            best = { weight: wt, reps: parseFloat(s.reps) || 0, workoutId: w.id };
          }
        });
      });
    });
    return best;
  };

  const records: Rec[] = [];

  const bench = matchAndFindMax('bench');
  if (bench.weight > 0) records.push({ label: 'Heaviest Bench', value: `${bench.weight} lb`, workoutId: bench.workoutId, weight: bench.weight });

  const squat = matchAndFindMax('squat');
  if (squat.weight > 0) records.push({ label: 'Heaviest Squat', value: `${squat.weight} lb`, workoutId: squat.workoutId, weight: squat.weight });

  const deadlift = matchAndFindMax('deadlift');
  if (deadlift.weight > 0) records.push({ label: 'Heaviest Deadlift', value: `${deadlift.weight} lb`, workoutId: deadlift.workoutId, weight: deadlift.weight });

  // Highest pull-up reps (bodyweight, so we look at reps not weight)
  let bestPullupReps = 0, pullupWorkoutId = '';
  workouts.forEach((w) => {
    w.exercises.forEach((ex) => {
      if (!ex.name.toLowerCase().includes('pull')) return;
      ex.sets.forEach((s) => {
        const rp = parseFloat(s.reps) || 0;
        if (rp > bestPullupReps) { bestPullupReps = rp; pullupWorkoutId = w.id; }
      });
    });
  });
  if (bestPullupReps > 0) records.push({ label: 'Highest Pull-up Reps', value: `${bestPullupReps} reps`, workoutId: pullupWorkoutId, weight: 0 });

  // Longest workout
  const longest = workouts.reduce((max, w) => (w.duration > max.duration ? w : max), workouts[0] ?? { duration: 0, id: '' });
  if (longest && longest.duration > 0) records.push({ label: 'Longest Workout', value: formatDuration(longest.duration), workoutId: longest.id, weight: 0 });

  // Highest volume session
  const highestVol = workouts.reduce((max, w) => (w.volume > max.volume ? w : max), workouts[0] ?? { volume: 0, id: '' });
  if (highestVol && highestVol.volume > 0) records.push({ label: 'Highest Volume Session', value: formatVolume(highestVol.volume), workoutId: highestVol.id, weight: 0 });

  // Most exercises in one workout
  const mostExercises = workouts.reduce((max, w) => (w.exercises.length > max.exercises.length ? w : max), workouts[0] ?? { exercises: [], id: '' });
  if (mostExercises && mostExercises.exercises.length > 0) records.push({ label: 'Most Exercises in One Workout', value: `${mostExercises.exercises.length} exercises`, workoutId: mostExercises.id, weight: 0 });

  // Newest PR — most recent workout that set any of the records above
  const recordWorkoutIds = new Set(records.map((r) => r.workoutId).filter(Boolean));
  const newest = workouts.find((w) => recordWorkoutIds.has(w.id));
  if (newest?.createdAt?.toDate) {
    records.push({
      label: 'Newest Personal Record',
      value: newest.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      workoutId: newest.id,
      weight: 0,
    });
  }

  return records;
}

// =====================================================
// Styles
// =====================================================
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F4F8' },
  scroll: { paddingBottom: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F4F8' },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14, fontWeight: '500' },

  // ── Hero ──
  hero: {
    paddingHorizontal: 20,
    paddingTop: STATUS_BAR_HEIGHT + 12,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 20,
  },
  heroEyebrow: { fontSize: 14, color: 'rgba(196,181,253,0.85)', fontWeight: '500' },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 1, marginBottom: 14 },

  heroBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  heroBadgeText: { fontSize: 12, color: '#fff', fontWeight: '700' },

  statsRow: { flexDirection: 'row' },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  statBig: { fontSize: 18, fontWeight: '900', color: '#fff' },
  statSub: { fontSize: 11, color: 'rgba(196,181,253,0.8)', marginTop: 3, textAlign: 'center' },

  // ── Section ──
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 24,
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

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { fontSize: 13, color: '#991B1B', flex: 1 },

  emptyState: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a2e', marginTop: 10 },
  emptySub: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18, marginTop: 4 },

  filterBar: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F2F2F7' },
  chipActive: { backgroundColor: '#7C3AED' },
  chipText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  // Overview grid (2-col)
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  overviewCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F0F0F2',
  },
  overviewIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  overviewValue: { fontSize: 18, fontWeight: '800', color: '#1a1a2e' },
  overviewLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontWeight: '600' },
  overviewFooterRow: { marginTop: 8 },
  pctRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  pctText: { fontSize: 10, fontWeight: '700' },

  // PR grid
  prGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  prCard: {
    width: '31%',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FDE68A',
  },
  prValue: { fontSize: 14, fontWeight: '800', color: '#92400E', marginTop: 6 },
  prLabel: { fontSize: 10, color: '#B45309', marginTop: 2, textAlign: 'center', fontWeight: '600' },

  // Charts
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  noDataText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 },

  // Pie + legend
  pieRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  legendCol: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 12, color: '#374151', fontWeight: '600' },
  legendValue: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },

  // Muscle filter pills
  musclePills: { marginBottom: 14 },
  musclePillRow: { flexDirection: 'row', gap: 6 },
  muscleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F2F2F7' },
  muscleChipActive: { backgroundColor: '#EDE9FE' },
  muscleText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  muscleTextActive: { color: '#7C3AED', fontWeight: '700' },

  // Timeline
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
    gap: 10,
  },
  timelineDateCol: { width: 52, alignItems: 'center' },
  timelineDate: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },
  timelineMain: { flex: 1 },
  timelineVolume: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  timelineMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  timelineExpand: { marginTop: 8, gap: 4 },
  timelineExerciseLine: { fontSize: 12, color: '#374151' },

  // Table
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 4,
  },
  tableCol: { flex: 1, fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  workoutRowLeft: { flex: 2 },
  workoutRowName: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  workoutRowSets: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  workoutRowReps: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '600' },
  workoutRowVolume: { flex: 1, fontSize: 14, color: '#374151', textAlign: 'right', fontWeight: '700' },
});