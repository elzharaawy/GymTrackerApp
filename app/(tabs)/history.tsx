import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

// --- Mock Data ---
const friends = [
  { id: 'all', label: 'All' },
  { id: 'me', label: 'George', avatar: '🙋' },
  { id: 'adnan', label: 'Adnan', avatar: '🤸' },
  { id: 'amanda', label: 'Amanda', avatar: '🏃' },
  { id: 'annie', label: 'Annie', avatar: '🧘' },
];

const workouts = [
  {
    id: 1,
    user: 'Me',
    userName: 'George',
    avatar: '🙋',
    date: 'Tuesday Sep 24, 2024 at 09:16 am',
    duration: '43:12',
    volume: '8,750 lb',
    calories: '203 cal',
    exercises: [
      {
        name: 'Bench Press (dumbbell)',
        sets: ['90 lb x 15', '90 lb x 15', '90 lb x 11', '90 lb x 6'],
      },
      {
        name: 'Incline Press (dumbbell)',
        sets: ['90 lb x 7', '80 lb x 11', '80 lb x 10', '80 lb x 6'],
      },
      {
        name: 'Triceps Pushdown',
        sets: ['50 lb x 10', '50 lb x 10', '50 lb x 9', '40 lb x 7'],
      },
    ],
    tags: ['chest', 'triceps'],
    likes: 3,
    likedBy: ['Henry', 'Hassan', 'Sohaib', 'Amanda'],
    isOwn: true,
  },
  {
    id: 2,
    user: 'Hassan',
    userName: 'Hassan',
    avatar: '🧗',
    date: 'Monday Sep 23, 2024 at 10:30 am',
    duration: '01:09:57',
    volume: '6,930 lb',
    calories: '',
    exercises: [
      {
        name: 'Squat (barbell)',
        sets: ['135 lb x 5', '135 lb x 5', '135 lb x 5', '135 lb x 5'],
      },
      {
        name: 'Goblet Squat',
        sets: ['60 lb x 10', '60 lb x 9', '60 lb x 9'],
      },
      { name: 'Sled Push', sets: ['105 lb x 8'] },
      {
        name: 'Seated Calf Raise',
        sets: ['45 lb x 13', '45 lb x 13', '45 lb x 12'],
      },
      {
        name: 'Hanging Leg Raise',
        sets: ['0 lb x 12', '0 lb x 12', '0 lb x 8'],
      },
    ],
    tags: ['abdominals', 'calves', 'quadriceps'],
    likes: 4,
    likedBy: ['George', 'Amanda', 'Sohaib'],
    isOwn: false,
  },
  {
    id: 3,
    user: 'Amanda',
    userName: 'Amanda',
    avatar: '🏃',
    date: 'Monday Sep 23, 2024 at 08:00 am',
    duration: '55:30',
    volume: '4,200 lb',
    calories: '310 cal',
    exercises: [
      { name: 'Romanian Deadlift', sets: ['95 lb x 12', '95 lb x 12', '95 lb x 10'] },
      { name: 'Leg Press', sets: ['180 lb x 15', '180 lb x 12', '160 lb x 10'] },
      { name: 'Hip Thrust', sets: ['135 lb x 15', '135 lb x 12', '135 lb x 10'] },
    ],
    tags: ['glutes', 'hamstrings'],
    likes: 6,
    likedBy: ['George', 'Hassan', 'Sohaib'],
    isOwn: false,
  },
];

const tagColors: Record<string, { bg: string; text: string }> = {
  chest: { bg: '#fef3c7', text: '#92400e' },
  triceps: { bg: '#ede9fe', text: '#5b21b6' },
  abdominals: { bg: '#ecfdf5', text: '#065f46' },
  calves: { bg: '#fce7f3', text: '#9d174d' },
  quadriceps: { bg: '#eff6ff', text: '#1e40af' },
  glutes: { bg: '#fff7ed', text: '#9a3412' },
  hamstrings: { bg: '#f0fdf4', text: '#166534' },
};

export default function HistoryScreen() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [liked, setLiked] = useState<Record<number, boolean>>({});

  const filtered =
    activeFilter === 'all'
      ? workouts
      : workouts.filter(
          (w) => w.userName.toLowerCase() === activeFilter.toLowerCase()
        );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.title}>History</Text>
      </View>

      {/* Friend Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {friends.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.friendChip, activeFilter === f.id && styles.friendChipActive]}
            onPress={() => setActiveFilter(f.id)}
          >
            {f.avatar && <Text style={styles.chipAvatar}>{f.avatar}</Text>}
            <Text style={[styles.chipLabel, activeFilter === f.id && styles.chipLabelActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Workout Feed */}
      <ScrollView style={styles.feed} showsVerticalScrollIndicator={false}>
        {filtered.map((workout) => (
          <View key={workout.id} style={styles.workoutCard}>
            {/* Card Header */}
            <View style={styles.cardHeader}>
              <View style={styles.userRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{workout.avatar}</Text>
                </View>
                <View>
                  <Text style={styles.userName}>{workout.user}</Text>
                  <Text style={styles.workoutDate}>{workout.date}</Text>
                </View>
              </View>
              <TouchableOpacity>
                <Text style={styles.moreBtn}>⋯</Text>
              </TouchableOpacity>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{workout.duration}</Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{workout.volume}</Text>
                <Text style={styles.statLabel}>Volume</Text>
              </View>
              {workout.calories ? (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{workout.calories}</Text>
                    <Text style={styles.statLabel}>Calories</Text>
                  </View>
                </>
              ) : null}
            </View>

            {/* Exercises */}
            <View style={styles.exerciseList}>
              {workout.exercises.map((ex, i) => (
                <View key={i} style={styles.exerciseRow}>
                  <Text style={styles.exerciseName}>{ex.name}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.setsRow}>
                      {ex.sets.map((set, j) => (
                        <View key={j} style={styles.setBadge}>
                          <Text style={styles.setText}>{set}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              ))}
            </View>

            {/* Tags */}
            <View style={styles.tagsRow}>
              {workout.tags.map((tag) => {
                const colors = tagColors[tag] || { bg: '#f3f4f6', text: '#374151' };
                return (
                  <View key={tag} style={[styles.tag, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.tagText, { color: colors.text }]}>{tag}</Text>
                  </View>
                );
              })}
            </View>

            {/* Like / Share */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.likeBtn}
                onPress={() => setLiked((l) => ({ ...l, [workout.id]: !l[workout.id] }))}
              >
                <Text style={{ fontSize: 20 }}>{liked[workout.id] ? '❤️' : '🤍'}</Text>
                <Text style={styles.likedByText}>
                  {workout.likedBy.slice(0, 3).join(', ')}
                  {workout.likedBy.length > 3 ? ` +${workout.likedBy.length - 3}` : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={styles.shareBtn}>↗</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f7f4' },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a2e' },

  // Friend filter
  filterScroll: { flexGrow: 0, marginBottom: 8 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  friendChipActive: { backgroundColor: '#1e1b4b', borderColor: '#1e1b4b' },
  chipAvatar: { fontSize: 14 },
  chipLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipLabelActive: { color: '#fff' },

  // Feed
  feed: { flex: 1, paddingHorizontal: 16 },
  workoutCard: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ede9fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 20 },
  userName: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  workoutDate: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  moreBtn: { fontSize: 20, color: '#9ca3af' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  statLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: '#e5e7eb' },

  // Exercises
  exerciseList: { gap: 10, marginBottom: 12 },
  exerciseRow: { gap: 6 },
  exerciseName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  setsRow: { flexDirection: 'row', gap: 6 },
  setBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  setText: { fontSize: 12, color: '#4b5563', fontWeight: '500' },

  // Tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tagText: { fontSize: 12, fontWeight: '600' },

  // Actions
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likedByText: { fontSize: 12, color: '#6b7280' },
  shareBtn: { fontSize: 20, color: '#9ca3af' },
});