import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  SafeAreaView,
} from 'react-native';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 64;

// --- Mock Data ---
const timeFilters = ['2y', '1y', '6m', '3m', '1m'];
const friendFilters = ['George', 'Adnan'];

const workoutsPerWeek = [
  { label: 'Feb 13', value: 3 },
  { label: 'Feb 19', value: 4 },
  { label: 'Feb 25', value: 4 },
  { label: 'Mar 3', value: 3 },
  { label: 'Mar 9', value: 3 },
  { label: 'Mar 14', value: 1 },
];

const volumeByWeek = [
  { label: 'Feb 13', value: 10000 },
  { label: '', value: 7000 },
  { label: 'Feb 19', value: 22000 },
  { label: '', value: 15000 },
  { label: 'Feb 25', value: 20000 },
  { label: '', value: 12000 },
  { label: 'Mar 3', value: 17000 },
  { label: '', value: 11000 },
  { label: 'Mar 9', value: 14000 },
  { label: '', value: 13000 },
  { label: 'Mar 14', value: 10000 },
  { label: '', value: 8000 },
];

const muscleFilters = ['all', 'abdominals', 'biceps', 'calves', 'chest', 'glutes'];

const allWorkouts = [
  { id: 1, name: 'Chest & Triceps', sets: 12, reps: 96, volume: '8,750 lb', pinned: false },
  { id: 2, name: 'Leg Day', sets: 16, reps: 128, volume: '12,400 lb', pinned: false },
  { id: 3, name: 'Pull Day', sets: 14, reps: 112, volume: '9,200 lb', pinned: false },
  { id: 4, name: 'Upper Body', sets: 10, reps: 80, volume: '6,100 lb', pinned: false },
];

// --- Simple Bar Chart Component ---
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
  const barWidth = Math.floor(CHART_WIDTH / data.length) - 4;

  return (
    <View style={{ width: CHART_WIDTH }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 4 }}>
        {data.map((d, i) => {
          const barH = Math.max(4, (d.value / maxValue) * height);
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height }}>
              <View
                style={{
                  width: barWidth > 6 ? barWidth : 6,
                  height: barH,
                  backgroundColor: color,
                  borderRadius: 4,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6, gap: 4 }}>
        {data.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            {d.label ? (
              <Text style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>{d.label}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

// --- Y-axis labels helper ---
function YAxis({ max, steps = 4 }: { max: number; steps?: number }) {
  const labels = Array.from({ length: steps + 1 }, (_, i) =>
    Math.round((max / steps) * (steps - i))
  );
  return (
    <View style={{ justifyContent: 'space-between', height: 120, paddingRight: 4 }}>
      {labels.map((l, i) => (
        <Text key={i} style={{ fontSize: 9, color: '#9ca3af', textAlign: 'right' }}>
          {l >= 1000 ? `${(l / 1000).toFixed(0)}k` : l}
        </Text>
      ))}
    </View>
  );
}

export default function StatsScreen() {
  const [timeFilter, setTimeFilter] = useState('1m');
  const [friendFilter, setFriendFilter] = useState('George');
  const [muscleFilter, setMuscleFilter] = useState('all');
  const [bodyTab, setBodyTab] = useState<'Workouts' | 'Body'>('Workouts');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Workout Stats</Text>
        </View>

        {/* Time + Friend Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
          {timeFilters.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, timeFilter === f && styles.chipActive]}
              onPress={() => setTimeFilter(f)}
            >
              <Text style={[styles.chipText, timeFilter === f && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.dividerV} />
          {friendFilters.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, friendFilter === f && styles.chipActive]}
              onPress={() => setFriendFilter(f)}
            >
              <Text style={[styles.chipText, friendFilter === f && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Overall Summary */}
        <Text style={styles.sectionTitle}>Overall summary</Text>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          {[
            { label: 'Total Workouts', value: '18' },
            { label: 'Total Volume', value: '148k lb' },
            { label: 'Avg Duration', value: '52 min' },
            { label: 'Active Weeks', value: '6' },
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
            <TouchableOpacity>
              <Text style={styles.shareIcon}>↗</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chartRow}>
            <YAxis max={4} />
            <BarChart data={workoutsPerWeek} maxValue={4} />
          </View>
        </View>

        {/* Volume by Primary Muscle */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Volume by primary muscle</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.musclePills}>
            <View style={styles.musclePillRow}>
              {muscleFilters.map((m) => (
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

          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Training volume</Text>
            <TouchableOpacity>
              <Text style={styles.shareIcon}>↗</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chartRow}>
            <YAxis max={25000} steps={4} />
            <BarChart data={volumeByWeek} maxValue={25000} color='#1e1b4b' />
          </View>
        </View>

        {/* Pinned Workouts */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pinned workouts</Text>
          <View style={styles.emptyPinned}>
            <Text style={styles.emptyIcon}>📌</Text>
            <Text style={styles.emptyText}>You haven't pinned any workouts yet</Text>
            <Text style={styles.emptyHint}>Pin workouts to track your progress over time</Text>
          </View>
        </View>

        {/* All Workouts */}
        <View style={styles.card}>
          <View style={styles.tabRow}>
            {(['Workouts', 'Body'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, bodyTab === t && styles.tabActive]}
                onPress={() => setBodyTab(t)}
              >
                <Text style={[styles.tabText, bodyTab === t && styles.tabTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Column Headers */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCol, { flex: 2 }]}>Best set</Text>
            <Text style={styles.tableCol}>Num reps</Text>
            <Text style={styles.tableCol}>Volume</Text>
          </View>

          {allWorkouts.map((w) => (
            <TouchableOpacity key={w.id} style={styles.workoutRow}>
              <View style={styles.workoutRowLeft}>
                <Text style={styles.workoutRowName}>{w.name}</Text>
                <Text style={styles.workoutRowSets}>{w.sets} sets</Text>
              </View>
              <Text style={styles.workoutRowReps}>{w.reps}</Text>
              <Text style={styles.workoutRowVolume}>{w.volume}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f7f4' },
  container: { flex: 1, paddingHorizontal: 16 },
  header: { paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a2e' },

  // Filters
  filterBar: { flexDirection: 'row', gap: 6, paddingBottom: 14, alignItems: 'center' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  chipActive: { backgroundColor: '#1e1b4b' },
  chipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  dividerV: { width: 1, height: 24, backgroundColor: '#e5e7eb', marginHorizontal: 4 },

  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 10 },

  // Summary Row
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1e1b4b',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
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
  shareIcon: { fontSize: 18, color: '#9ca3af' },

  // Chart
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },

  // Muscle filter pills
  musclePills: { marginBottom: 14 },
  musclePillRow: { flexDirection: 'row', gap: 6 },
  muscleChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  muscleChipActive: { backgroundColor: '#ede9fe' },
  muscleText: { fontSize: 12, color: '#6b7280' },
  muscleTextActive: { color: '#7c3aed', fontWeight: '600' },

  // Empty pinned
  emptyPinned: { alignItems: 'center', paddingVertical: 20 },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#374151', fontWeight: '600', marginBottom: 4 },
  emptyHint: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
    alignSelf: 'flex-start',
  },
  tab: { paddingHorizontal: 20, paddingVertical: 6, borderRadius: 8 },
  tabActive: { backgroundColor: '#1e1b4b' },
  tabText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  tabTextActive: { color: '#fff' },

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
  workoutRowSets: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  workoutRowReps: { flex: 1, fontSize: 14, color: '#374151' },
  workoutRowVolume: { flex: 1, fontSize: 14, color: '#374151', textAlign: 'right' },
});