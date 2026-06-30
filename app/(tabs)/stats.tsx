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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { auth, db } from '../../firebaseConfig';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 32 - 32 - 36; // section padding (16*2) + card padding (16*2) + y-axis gutter

// Status bar height, matched to HomeScreen's hero padding logic
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 50;

// --- Types matching what workout.tsx saves ---
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

const timeFilters: { id: string; label: string; days: number | null }[] = [
  { id: '1m', label: '1m', days: 30 },
  { id: '3m', label: '3m', days: 90 },
  { id: '6m', label: '6m', days: 180 },
  { id: '1y', label: '1y', days: 365 },
  { id: 'all', label: 'All', days: null },
];

// Maps the `section` param HomeScreen passes (from each Today's Summary
// card) to the anchor inside this screen it should scroll to.
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

// --- Chart Components (unchanged logic, recolored to match Home palette) ---
function BarChart({
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
            <View
              key={i}
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
                  borderRadius: 4,
                }}
              />
            </View>
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
  const [workouts, setWorkouts] = useState<WorkoutDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState('3m');
  const [muscleFilter, setMuscleFilter] = useState('all');

  // --- Live query: only this user's workouts ---
  // NOTE: no orderBy() here — combining where('userId', ...) with
  // orderBy('createdAt', ...) requires a Firestore composite index. Without
  // it the query throws and onSnapshot's error callback fires, which used
  // to silently leave the screen showing stale/empty data. Sorting is done
  // client-side below instead.
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
          .map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              userId: d.userId,
              duration: d.duration || 0,
              volume: d.volume || 0,
              exercises: d.exercises || [],
              muscles: d.muscles || [],
              createdAt: d.createdAt || null,
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

  // --- Filter by time range ---
  const activeFilter = timeFilters.find((f) => f.id === timeFilter)!;
  const filteredWorkouts = useMemo(() => {
    if (!activeFilter.days) return workouts;
    const cutoff = Date.now() - activeFilter.days * 24 * 60 * 60 * 1000;
    return workouts.filter((w) => {
      const ts = w.createdAt?.toMillis ? w.createdAt.toMillis() : 0;
      return ts >= cutoff;
    });
  }, [workouts, timeFilter]);

  // --- Available muscles from actual data ---
  const availableMuscles = useMemo(() => {
    const set = new Set<string>();
    workouts.forEach((w) => w.muscles.forEach((m) => set.add(m)));
    return ['all', ...Array.from(set).sort()];
  }, [workouts]);

  // --- Summary stats ---
  const summary = useMemo(() => {
    const totalWorkouts = filteredWorkouts.length;
    const totalVolume = filteredWorkouts.reduce((s, w) => s + w.volume, 0);
    const totalDuration = filteredWorkouts.reduce((s, w) => s + w.duration, 0);
    const avgDurationSec = totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0;

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
    };
  }, [filteredWorkouts]);

  // --- Workouts per week (last 6 buckets) ---
  const workoutsPerWeek = useMemo(() => buildWeeklyBuckets(filteredWorkouts, 6, 'count'), [filteredWorkouts]);

  // --- Volume by week (last 6 buckets) ---
  const volumeByWeek = useMemo(() => buildWeeklyBuckets(filteredWorkouts, 6, 'volume'), [filteredWorkouts]);

  // --- Volume by muscle ---
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

  // --- Exercise breakdown table ---
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

  // --- Scroll-to-section wiring ---
  // HomeScreen's Today's Summary cards navigate here with a `section` param
  // (e.g. "volume", "exercises"). We map that to one of our anchors and
  // scroll to it once layout has happened.
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
    // Small delay so the ScrollView has finished laying out cards.
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(anchorY.current[target] - 12, 0), animated: true });
    }, 250);
    return () => clearTimeout(t);
  }, [params.section, loading, filteredWorkouts.length]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Loading your stats…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── HERO HEADER (mirrors HomeScreen) ── */}
        <LinearGradient colors={['#1a0533', '#2d1060', '#3b0f8f']} style={styles.hero}>
          <Text style={styles.heroEyebrow}>Performance</Text>
          <Text style={styles.heroTitle}>Your Stats</Text>

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
                    onPress={() => setTimeFilter(f.id)}
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

            {/* Summary */}
            <View style={styles.section} onLayout={registerAnchor('summary')}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Overall summary</Text>
              </View>
              <View style={styles.summaryGrid}>
                {[
                  { icon: 'barbell-outline' as const, label: 'Total Workouts', value: String(summary.totalWorkouts), color: '#7C3AED', bg: '#EDE9FE' },
                  { icon: 'fitness-outline' as const, label: 'Total Volume', value: formatVolume(summary.totalVolume), color: '#D97706', bg: '#FEF3C7' },
                  { icon: 'time-outline' as const, label: 'Avg Duration', value: formatDuration(summary.avgDurationSec), color: '#0284C7', bg: '#E0F2FE' },
                  { icon: 'flame-outline' as const, label: 'Active Weeks', value: String(summary.activeWeeks), color: '#DC2626', bg: '#FEE2E2' },
                ].map((s) => (
                  <View key={s.label} style={styles.summaryCard}>
                    <View style={[styles.summaryIconCircle, { backgroundColor: s.bg }]}>
                      <Ionicons name={s.icon} size={16} color={s.color} />
                    </View>
                    <Text style={styles.summaryValue}>{s.value}</Text>
                    <Text style={styles.summaryLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Workouts per Week */}
            <View style={styles.section} onLayout={registerAnchor('weekly')}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Workouts per week</Text>
              </View>
              {workoutsPerWeek.some((d) => d.value > 0) ? (
                <View style={styles.chartRow}>
                  <YAxis max={maxWeeklyCount} steps={Math.min(4, maxWeeklyCount)} />
                  <BarChart data={workoutsPerWeek} maxValue={maxWeeklyCount} color="#7C3AED" />
                </View>
              ) : (
                <Text style={styles.noDataText}>Not enough data yet</Text>
              )}
            </View>

            {/* Volume by Muscle */}
            <View style={styles.section} onLayout={registerAnchor('muscleVolume')}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Volume by primary muscle</Text>
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

              {volumeByMuscle.length > 0 ? (
                <View style={styles.chartRow}>
                  <YAxis max={maxMuscleVolume} steps={4} formatK />
                  <BarChart data={volumeByMuscle} maxValue={maxMuscleVolume} color="#9333EA" />
                </View>
              ) : (
                <Text style={styles.noDataText}>Not enough data yet</Text>
              )}
            </View>

            {/* Training Volume Over Time */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Training volume</Text>
              </View>
              {volumeByWeek.some((d) => d.value > 0) ? (
                <View style={styles.chartRow}>
                  <YAxis max={maxWeeklyVolume} steps={4} formatK />
                  <BarChart data={volumeByWeek} maxValue={maxWeeklyVolume} color="#5B21B6" />
                </View>
              ) : (
                <Text style={styles.noDataText}>Not enough data yet</Text>
              )}
            </View>

            {/* Exercise Breakdown Table */}
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

// --- Helpers (unchanged) ---
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
  mode: 'count' | 'volume'
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
      bucket.value += mode === 'count' ? 1 : w.volume;
    }
  });

  return buckets.map((b) => ({ label: b.label, value: b.value }));
}

// ─────────────────────────────────────────────
// Styles — mirrors HomeScreen.tsx: same hero gradient, same white
// `section` card (radius 20, #6D28D9-tinted shadow), same typography scale
// (#1a1a2e headings, #7C3AED accent, #9CA3AF muted text).
// ─────────────────────────────────────────────
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
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 1, marginBottom: 18 },

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

  // ── Section (same surface as HomeScreen's `section`) ──
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

  // Error banner
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { fontSize: 13, color: '#991B1B', flex: 1 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a2e', marginTop: 10 },
  emptySub: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18, marginTop: 4 },

  // Filters
  filterBar: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F2F2F7' },
  chipActive: { backgroundColor: '#7C3AED' },
  chipText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  // Summary grid (2-col, matches Home's summary card language)
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  summaryCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F0F0F2',
  },
  summaryIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryValue: { fontSize: 17, fontWeight: '800', color: '#1a1a2e' },
  summaryLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontWeight: '600' },

  // Charts
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  noDataText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 },

  // Muscle filter pills
  musclePills: { marginBottom: 14 },
  musclePillRow: { flexDirection: 'row', gap: 6 },
  muscleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F2F2F7' },
  muscleChipActive: { backgroundColor: '#EDE9FE' },
  muscleText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  muscleTextActive: { color: '#7C3AED', fontWeight: '700' },

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