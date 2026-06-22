import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// --- Types ---
interface SetEntry {
  id: string;
  weight: string;
  reps: string;
  done: boolean;
}

interface ExerciseEntry {
  id: string;
  name: string;
  muscle: string;
  sets: SetEntry[];
}

// --- Exercise Library ---
const EXERCISE_LIBRARY: { name: string; muscle: string; icon: string }[] = [
  { name: 'Bench Press (barbell)', muscle: 'Chest', icon: '🏋️' },
  { name: 'Bench Press (dumbbell)', muscle: 'Chest', icon: '🏋️' },
  { name: 'Incline Press (dumbbell)', muscle: 'Chest', icon: '🏋️' },
  { name: 'Squat (barbell)', muscle: 'Legs', icon: '🦵' },
  { name: 'Goblet Squat', muscle: 'Legs', icon: '🦵' },
  { name: 'Romanian Deadlift', muscle: 'Legs', icon: '🦵' },
  { name: 'Deadlift (barbell)', muscle: 'Legs', icon: '🦵' },
  { name: 'Leg Press', muscle: 'Legs', icon: '🦵' },
  { name: 'Hip Thrust', muscle: 'Glutes', icon: '🍑' },
  { name: 'Pull Up', muscle: 'Back', icon: '🔝' },
  { name: 'Lat Pulldown', muscle: 'Back', icon: '🔝' },
  { name: 'Seated Row', muscle: 'Back', icon: '🔝' },
  { name: 'Overhead Press', muscle: 'Shoulders', icon: '💪' },
  { name: 'Lateral Raise', muscle: 'Shoulders', icon: '💪' },
  { name: 'Triceps Pushdown', muscle: 'Arms', icon: '💪' },
  { name: 'Bicep Curl (dumbbell)', muscle: 'Arms', icon: '💪' },
  { name: 'Hanging Leg Raise', muscle: 'Core', icon: '🧘' },
  { name: 'Plank', muscle: 'Core', icon: '🧘' },
  { name: 'Seated Calf Raise', muscle: 'Legs', icon: '🦵' },
];

const MUSCLE_FILTERS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Glutes'];

const muscleColors: Record<string, { bg: string; text: string }> = {
  Chest:     { bg: '#FEF3C7', text: '#92400E' },
  Arms:      { bg: '#EDE9FE', text: '#5B21B6' },
  Back:      { bg: '#E0E7FF', text: '#3730A3' },
  Core:      { bg: '#ECFDF5', text: '#065F46' },
  Legs:      { bg: '#EFF6FF', text: '#1E40AF' },
  Glutes:    { bg: '#FFF7ED', text: '#9A3412' },
  Shoulders: { bg: '#FEF2F2', text: '#991B1B' },
};

const uid = () => Math.random().toString(36).slice(2, 10);

export default function WorkoutScreen() {
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('All');
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  // Rest timer state
  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const REST_DURATION = 90;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse for rest timer button
  useEffect(() => {
    if (restRunning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [restRunning]);

  useEffect(() => {
    if (exercises.length > 0 && !running) setRunning(true);
  }, [exercises.length]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else if (intervalRef.current) clearInterval(intervalRef.current);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  useEffect(() => {
    if (restRunning) {
      restIntervalRef.current = setInterval(() => {
        setRestSeconds(s => {
          if (s >= REST_DURATION) {
            setRestRunning(false);
            return 0;
          }
          return s + 1;
        });
      }, 1000);
    } else {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    }
    return () => { if (restIntervalRef.current) clearInterval(restIntervalRef.current); };
  }, [restRunning]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const totalVolume = exercises.reduce((sum, ex) =>
    sum + ex.sets.reduce((s, set) => {
      const w = parseFloat(set.weight) || 0;
      const r = parseFloat(set.reps) || 0;
      return s + (set.done ? w * r : 0);
    }, 0), 0);

  const totalSetsDone = exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.done).length, 0);

  const addExercise = (libItem: { name: string; muscle: string; icon: string }) => {
    setExercises(prev => [
      ...prev,
      { id: uid(), name: libItem.name, muscle: libItem.muscle,
        sets: [{ id: uid(), weight: '', reps: '', done: false }] },
    ]);
    setPickerVisible(false);
    setSearch('');
    setMuscleFilter('All');
  };

  const addSet = (exId: string) => {
    setExercises(prev => prev.map(ex => {
      if (ex.id !== exId) return ex;
      const last = ex.sets[ex.sets.length - 1];
      return { ...ex, sets: [...ex.sets, { id: uid(), weight: last?.weight || '', reps: last?.reps || '', done: false }] };
    }));
  };

  const updateSet = (exId: string, setId: string, field: 'weight' | 'reps', value: string) => {
    setExercises(prev => prev.map(ex =>
      ex.id !== exId ? ex : { ...ex, sets: ex.sets.map(s => s.id === setId ? { ...s, [field]: value } : s) }
    ));
  };

  const toggleSetDone = (exId: string, setId: string) => {
    setExercises(prev => prev.map(ex =>
      ex.id !== exId ? ex : { ...ex, sets: ex.sets.map(s => s.id === setId ? { ...s, done: !s.done } : s) }
    ));
    // Auto-start rest timer when marking set done
    setRestSeconds(0);
    setRestRunning(true);
  };

  const removeSet = (exId: string, setId: string) => {
    setExercises(prev => prev.map(ex =>
      ex.id !== exId ? ex : { ...ex, sets: ex.sets.filter(s => s.id !== setId) }
    ));
  };

  const removeExercise = (exId: string) => {
    Alert.alert('Remove exercise?', 'All sets for this exercise will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setExercises(prev => prev.filter(ex => ex.id !== exId)) },
    ]);
  };

  const handleDiscard = () => {
    if (exercises.length === 0) return;
    Alert.alert('Discard Workout', 'This will erase your current progress.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { setExercises([]); setSeconds(0); setRunning(false); setRestRunning(false); } },
    ]);
  };

  const handleFinish = async () => {
    if (exercises.length === 0) { Alert.alert('Nothing to save', 'Add at least one exercise first.'); return; }
    const user = auth.currentUser;
    if (!user) { Alert.alert('Not signed in'); return; }
    try {
      setSaving(true); setRunning(false); setRestRunning(false);
      const cleanExercises = exercises
        .map(ex => ({ name: ex.name, muscle: ex.muscle, sets: ex.sets.filter(s => s.done).map(s => ({ weight: s.weight, reps: s.reps })) }))
        .filter(ex => ex.sets.length > 0);
      if (cleanExercises.length === 0) {
        Alert.alert('No completed sets', 'Mark at least one set as done before finishing.');
        setSaving(false); setRunning(true); return;
      }
      await addDoc(collection(db, 'workouts'), {
        userId: user.uid, userName: user.displayName || 'Me',
        duration: seconds, volume: totalVolume,
        exercises: cleanExercises, muscles: Array.from(new Set(cleanExercises.map(e => e.muscle))),
        createdAt: serverTimestamp(),
      });
      setExercises([]); setSeconds(0);
      Alert.alert('Workout saved 💪', `Logged ${cleanExercises.length} exercise(s).`);
    } catch (error: any) { Alert.alert('Error', error.message); setRunning(true); }
    finally { setSaving(false); }
  };

  const filteredLibrary = EXERCISE_LIBRARY.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchesMuscle = muscleFilter === 'All' || e.muscle === muscleFilter;
    return matchesSearch && matchesMuscle;
  });

  const isActive = exercises.length > 0;
  const restProgress = restSeconds / REST_DURATION;

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── HERO HEADER ── */}
      <LinearGradient
        colors={isActive ? ['#1a0533', '#2d1060', '#3b0f8f'] : ['#1e1b4b', '#312e81']}
        style={styles.hero}
      >
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroLabel}>{isActive ? 'In Progress' : 'Workout'}</Text>
            {isActive && (
              <Text style={styles.heroTimer}>{formatTime(seconds)}</Text>
            )}
            {!isActive && (
              <Text style={styles.heroSubtitle}>Build your session</Text>
            )}
          </View>
          {isActive && (
            <TouchableOpacity onPress={handleDiscard} style={styles.discardBtn}>
              <Text style={styles.discardText}>Discard</Text>
            </TouchableOpacity>
          )}
        </View>

        {isActive && (
          <View style={styles.heroStats}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatVal}>{exercises.length}</Text>
              <Text style={styles.heroStatLabel}>Exercises</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatVal}>{totalSetsDone}</Text>
              <Text style={styles.heroStatLabel}>Sets Done</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatVal}>{totalVolume > 0 ? `${(totalVolume).toLocaleString()}` : '—'}</Text>
              <Text style={styles.heroStatLabel}>Volume (kg)</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* ── REST TIMER BAR (shows after a set is logged) ── */}
      {restRunning && (
        <View style={styles.restBar}>
          <View style={styles.restBarFill}>
            <Animated.View style={[styles.restProgress, { width: `${(1 - restProgress) * 100}%` as any }]} />
          </View>
          <View style={styles.restBarContent}>
            <Ionicons name="timer-outline" size={14} color="#7C3AED" />
            <Text style={styles.restBarText}>Rest  {formatTime(REST_DURATION - restSeconds)}</Text>
            <TouchableOpacity onPress={() => { setRestRunning(false); setRestSeconds(0); }}>
              <Text style={styles.restSkip}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView style={styles.feed} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* ── EMPTY STATE ── */}
        {!isActive && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>No exercises yet</Text>
            <Text style={styles.emptySub}>Tap "Add Exercise" to start building your workout</Text>
          </View>
        )}

        {/* ── EXERCISE CARDS ── */}
        {exercises.map((ex, exIdx) => {
          const colors = muscleColors[ex.muscle] || { bg: '#F3F4F6', text: '#374151' };
          const completedSets = ex.sets.filter(s => s.done).length;
          const nextEx = exercises[exIdx + 1];

          return (
            <View key={ex.id} style={styles.exerciseCard}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardExName}>{ex.name}</Text>
                  <View style={styles.cardMeta}>
                    <View style={[styles.muscleChip, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.muscleChipText, { color: colors.text }]}>{ex.muscle}</Text>
                    </View>
                    <Text style={styles.cardSetCount}>{completedSets}/{ex.sets.length} sets</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => removeExercise(ex.id)} style={styles.removeExBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={17} color="#D1D5DB" />
                </TouchableOpacity>
              </View>

              {/* Column headers */}
              <View style={styles.setColHeaders}>
                <Text style={[styles.setColLabel, { width: 28 }]}>SET</Text>
                <Text style={[styles.setColLabel, { flex: 1 }]}>KG</Text>
                <Text style={[styles.setColLabel, { flex: 1 }]}>REPS</Text>
                <View style={{ width: 64 }} />
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
                    placeholderTextColor="#D1D5DB"
                    editable={!set.done}
                  />
                  <TextInput
                    style={[styles.setInput, set.done && styles.setInputDone]}
                    value={set.reps}
                    onChangeText={v => updateSet(ex.id, set.id, 'reps', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#D1D5DB"
                    editable={!set.done}
                  />
                  <TouchableOpacity
                    style={[styles.checkBtn, set.done && styles.checkBtnDone]}
                    onPress={() => toggleSetDone(ex.id, set.id)}
                  >
                    <Ionicons name="checkmark" size={15} color={set.done ? '#fff' : '#9CA3AF'} />
                  </TouchableOpacity>
                  {!set.done && (
                    <TouchableOpacity onPress={() => removeSet(ex.id, set.id)} style={styles.removeSetBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={13} color="#D1D5DB" />
                    </TouchableOpacity>
                  )}
                  {set.done && <View style={{ width: 24 }} />}
                </View>
              ))}

              {/* Add Set */}
              <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(ex.id)}>
                <Ionicons name="add" size={15} color="#7C3AED" />
                <Text style={styles.addSetText}>Add Set</Text>
              </TouchableOpacity>

              {/* Next Up preview */}
              {nextEx && (
                <View style={styles.nextUpRow}>
                  <Text style={styles.nextUpLabel}>Next up</Text>
                  <Text style={styles.nextUpName}>{nextEx.name}</Text>
                  <View style={[styles.muscleChip, { backgroundColor: (muscleColors[nextEx.muscle] || { bg: '#F3F4F6' }).bg }]}>
                    <Text style={[styles.muscleChipText, { color: (muscleColors[nextEx.muscle] || { text: '#374151' }).text }]}>{nextEx.muscle}</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* ── BUTTONS ── */}
        <TouchableOpacity style={styles.addExBtn} onPress={() => setPickerVisible(true)} activeOpacity={0.85}>
          <LinearGradient colors={['#4C1D95', '#6D28D9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addExGrad}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.addExText}>Add Exercise</Text>
          </LinearGradient>
        </TouchableOpacity>

        {isActive && (
          <TouchableOpacity
            style={[styles.finishBtn, saving && { opacity: 0.6 }]}
            onPress={handleFinish}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.finishText}>{saving ? 'Saving…' : 'Finish Workout'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── EXERCISE PICKER MODAL ── */}
      <Modal visible={pickerVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* Modal header */}
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add Exercise</Text>
              <TouchableOpacity onPress={() => { setPickerVisible(false); setSearch(''); setMuscleFilter('All'); }}>
                <View style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={18} color="#6B7280" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={16} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search exercises…"
                placeholderTextColor="#9CA3AF"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Muscle filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {MUSCLE_FILTERS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, muscleFilter === f && styles.filterChipActive]}
                  onPress={() => setMuscleFilter(f)}
                >
                  <Text style={[styles.filterChipText, muscleFilter === f && styles.filterChipTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Exercise list */}
            <ScrollView style={styles.libraryList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {filteredLibrary.map(item => {
                const colors = muscleColors[item.muscle] || { bg: '#F3F4F6', text: '#374151' };
                return (
                  <TouchableOpacity key={item.name} style={styles.libraryRow} onPress={() => addExercise(item)} activeOpacity={0.7}>
                    <View style={styles.libraryIcon}>
                      <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.libraryName}>{item.name}</Text>
                      <View style={[styles.muscleChip, { backgroundColor: colors.bg, alignSelf: 'flex-start', marginTop: 3 }]}>
                        <Text style={[styles.muscleChipText, { color: colors.text }]}>{item.muscle}</Text>
                      </View>
                    </View>
                    <View style={styles.libraryAddBtn}>
                      <Ionicons name="add" size={18} color="#7C3AED" />
                    </View>
                  </TouchableOpacity>
                );
              })}
              {filteredLibrary.length === 0 && (
                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                  <Text style={{ fontSize: 32, marginBottom: 10 }}>🔍</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 14 }}>No exercises found</Text>
                </View>
              )}
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F4F8' },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  heroLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(196,181,253,0.85)', marginBottom: 4 },
  heroTimer: { fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  heroSubtitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  discardBtn: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: 'rgba(225,29,72,0.18)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(225,29,72,0.3)' },
  discardText: { fontSize: 13, color: '#FB7185', fontWeight: '700' },
  heroStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 14 },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatVal: { fontSize: 19, fontWeight: '900', color: '#fff' },
  heroStatLabel: { fontSize: 10, color: 'rgba(196,181,253,0.8)', marginTop: 3 },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 2 },

  // Rest bar
  restBar: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  restBarFill: { height: 3, backgroundColor: '#EDE9FE', width: '100%' },
  restProgress: { height: 3, backgroundColor: '#7C3AED', position: 'absolute', left: 0, top: 0 },
  restBarContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  restBarText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#7C3AED' },
  restSkip: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },

  // Feed
  feed: { flex: 1, paddingHorizontal: 16 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, paddingBottom: 24 },
  emptyIcon: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  // Exercise card
  exerciseCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#6D28D9',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  cardExName: { fontSize: 16, fontWeight: '800', color: '#1a1a2e', marginBottom: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardSetCount: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  removeExBtn: { padding: 4 },

  // Column headers
  setColHeaders: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4, gap: 8 },
  setColLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5 },

  // Set row
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  setRowDone: { backgroundColor: '#F0FDF4' },
  setNum: { width: 20, fontSize: 13, fontWeight: '800', color: '#9CA3AF', textAlign: 'center' },
  setNumDone: { color: '#22C55E' },
  setInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 9,
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlign: 'center',
  },
  setInputDone: { borderColor: '#BBF7D0', color: '#16A34A', backgroundColor: '#F0FDF4' },
  checkBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBtnDone: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  removeSetBtn: { width: 24, justifyContent: 'center', alignItems: 'center' },

  // Add set
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    marginTop: 2,
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
  },
  addSetText: { fontSize: 13, fontWeight: '700', color: '#7C3AED' },

  // Next up
  nextUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  nextUpLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  nextUpName: { fontSize: 13, fontWeight: '700', color: '#374151', flex: 1 },

  // Muscle chip
  muscleChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  muscleChipText: { fontSize: 11, fontWeight: '700' },

  // Add exercise button
  addExBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  addExGrad: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 16, gap: 8,
  },
  addExText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Finish button
  finishBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    height: '80%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 14 },
  modalHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1a1a2e' },
  modalCloseBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    marginHorizontal: 16, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a2e' },
  filterRow: { marginBottom: 12, flexGrow: 0 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 7,
    backgroundColor: '#F3F4F6', borderRadius: 20,
  },
  filterChipActive: { backgroundColor: '#7C3AED' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterChipTextActive: { color: '#fff' },
  libraryList: { flex: 1, paddingHorizontal: 16 },
  libraryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  libraryIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#F5F3FF', justifyContent: 'center', alignItems: 'center',
  },
  libraryName: { fontSize: 15, color: '#1a1a2e', fontWeight: '600' },
  libraryAddBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#F5F3FF', justifyContent: 'center', alignItems: 'center',
  },
});