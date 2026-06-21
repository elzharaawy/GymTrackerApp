import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebaseConfig';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 64;

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

const muscleColors: Record<string, { bg: string; text: string }> = {
  chest: { bg: '#fef3c7', text: '#92400e' },
  triceps: { bg: '#ede9fe', text: '#5b21b6' },
  biceps: { bg: '#fae8ff', text: '#86198f' },
  abdominals: { bg: '#ecfdf5', text: '#065f46' },
  calves: { bg: '#fce7f3', text: '#9d174d' },
  quadriceps: { bg: '#eff6ff', text: '#1e40af' },
  glutes: { bg: '#fff7ed', text: '#9a3412' },
  hamstrings: { bg: '#f0fdf4', text: '#166534' },
  back: { bg: '#f5f3ff', text: '#5b21b6' },
  shoulders: { bg: '#fef2f2', text: '#991b1b' },
};

// --- Chart Components ---
function BarChart({
  data,
  maxValue,
  color = '#1e1b4b',
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
            <Text style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center' }} numberOfLines={1}>
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
        <Text key={i} style={{ fontSize: 9, color: '#9ca3af', textAlign: 'right' }}>
          {formatK && l >= 1000 ? `${(l / 1000).toFixed(0)}k` : l}
        </Text>
      ))}
    </View>
  );
}

export default function StatsScreen() {
  const [workouts, setWorkouts] = useState<WorkoutDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState('3m');
  const [muscleFilter, setMuscleFilter] = useState('all');

  // --- Live query: only this user's workouts ---
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      setError('Please log in to view your stats.');
      return;
    }

    const q = query(
      collection(db, 'workouts'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: WorkoutDoc[] = snapshot.docs.map((doc) => {
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
        });
        setWorkouts(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
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

  // --- Volume by muscle (respecting muscle filter for highlighting, but chart shows all) ---
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

  // --- Exercise breakdown table (best set + totals per exercise name) ---
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

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e1b4b" />
        <Text style={styles.loadingText}>Loading your stats…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Stats</Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#991b1b" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!error && workouts.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No workouts yet</Text>
            <Text style={styles.emptySub}>
              Finish a workout from the Workout tab and your stats will show up here.
            </Text>
          </View>
        )}

        {!error && workouts.length > 0 && (
          <>
            {/* Time Filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterBar}
            >
              {timeFilters.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.chip, timeFilter === f.id && styles.chipActive]}
                  onPress={() => setTimeFilter(f.id)}
                >
                  <Text style={[styles.chipText, timeFilter === f.id && styles.chipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Summary */}
            <Text style={styles.sectionTitle}>Overall summary</Text>
            <View style={styles.summaryRow}>
              {[
                { label: 'Total Workouts', value: String(summary.totalWorkouts) },
                { label: 'Total Volume', value: formatVolume(summary.totalVolume) },
                { label: 'Avg Duration', value: formatDuration(summary.avgDurationSec) },
                { label: 'Active Weeks', value: String(summary.activeWeeks) },
              ].map((s) => (
                <View key={s.label} style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{s.value}</Text>
                  <Text style={styles.summaryLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Workouts per Week */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Workouts per week</Text>
              </View>
              {workoutsPerWeek.some((d) => d.value > 0) ? (
                <View style={styles.chartRow}>
                  <YAxis max={maxWeeklyCount} steps={Math.min(4, maxWeeklyCount)} />
                  <BarChart data={workoutsPerWeek} maxValue={maxWeeklyCount} />
                </View>
              ) : (
                <Text style={styles.noDataText}>Not enough data yet</Text>
              )}
            </View>

            {/* Volume by Muscle */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Volume by primary muscle</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.musclePills}>
                <View style={styles.musclePillRow}>
                  {availableMuscles.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.muscleChip, muscleFilter === m && styles.muscleChipActive]}
                      onPress={() => setMuscleFilter(m)}
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
                  <BarChart data={volumeByMuscle} maxValue={maxMuscleVolume} color="#7c3aed" />
                </View>
              ) : (
                <Text style={styles.noDataText}>Not enough data yet</Text>
              )}
            </View>

            {/* Training Volume Over Time */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Training volume</Text>
              </View>
              {volumeByWeek.some((d) => d.value > 0) ? (
                <View style={styles.chartRow}>
                  <YAxis max={maxWeeklyVolume} steps={4} formatK />
                  <BarChart data={volumeByWeek} maxValue={maxWeeklyVolume} color="#1e1b4b" />
                </View>
              ) : (
                <Text style={styles.noDataText}>Not enough data yet</Text>
              )}
            </View>

            {/* Exercise Breakdown Table */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your exercises</Text>
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

// --- Helpers ---
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f7f4' },
  container: { flex: 1, paddingHorizontal: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f7f4' },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 14 },

  header: { paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a2e' },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { fontSize: 13, color: '#991b1b', flex: 1 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 18 },

  // Filters
  filterBar: { flexDirection: 'row', gap: 6, paddingBottom: 14, alignItems: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f3f4f6' },
  chipActive: { backgroundColor: '#1e1b4b' },
  chipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 10 },

  // Summary Row
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  summaryCard: { flex: 1, backgroundColor: '#1e1b4b', borderRadius: 12, padding: 12, alignItems: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '800', color: '#fff' },
  summaryLabel: { fontSize: 10, color: '#c4b5fd', marginTop: 3, textAlign: 'center' },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },

  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  noDataText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 24 },

  // Muscle filter pills
  musclePills: { marginBottom: 14 },
  musclePillRow: { flexDirection: 'row', gap: 6 },
  muscleChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: '#f3f4f6' },
  muscleChipActive: { backgroundColor: '#ede9fe' },
  muscleText: { fontSize: 12, color: '#6b7280' },
  muscleTextActive: { color: '#7c3aed', fontWeight: '600' },

  // Table
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 4,
  },
  tableCol: { flex: 1, fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  workoutRowLeft: { flex: 2 },
  workoutRowName: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  workoutRowSets: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  workoutRowReps: { flex: 1, fontSize: 14, color: '#374151' },
  workoutRowVolume: { flex: 1, fontSize: 14, color: '#374151', textAlign: 'right' },
});