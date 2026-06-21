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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

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

// --- Exercise Library (pickable) ---
const EXERCISE_LIBRARY: { name: string; muscle: string }[] = [
  { name: 'Bench Press (barbell)', muscle: 'chest' },
  { name: 'Bench Press (dumbbell)', muscle: 'chest' },
  { name: 'Incline Press (dumbbell)', muscle: 'chest' },
  { name: 'Squat (barbell)', muscle: 'quadriceps' },
  { name: 'Goblet Squat', muscle: 'quadriceps' },
  { name: 'Romanian Deadlift', muscle: 'hamstrings' },
  { name: 'Deadlift (barbell)', muscle: 'hamstrings' },
  { name: 'Leg Press', muscle: 'quadriceps' },
  { name: 'Hip Thrust', muscle: 'glutes' },
  { name: 'Pull Up', muscle: 'back' },
  { name: 'Lat Pulldown', muscle: 'back' },
  { name: 'Seated Row', muscle: 'back' },
  { name: 'Overhead Press', muscle: 'shoulders' },
  { name: 'Lateral Raise', muscle: 'shoulders' },
  { name: 'Triceps Pushdown', muscle: 'triceps' },
  { name: 'Bicep Curl (dumbbell)', muscle: 'biceps' },
  { name: 'Hanging Leg Raise', muscle: 'abdominals' },
  { name: 'Plank', muscle: 'abdominals' },
  { name: 'Seated Calf Raise', muscle: 'calves' },
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

const uid = () => Math.random().toString(36).slice(2, 10);

export default function WorkoutScreen() {
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-start timer once first exercise is added
  useEffect(() => {
    if (exercises.length > 0 && !running) {
      setRunning(true);
    }
  }, [exercises.length]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // --- Volume calculation ---
  const totalVolume = exercises.reduce((sum, ex) => {
    return (
      sum +
      ex.sets.reduce((s, set) => {
        const w = parseFloat(set.weight) || 0;
        const r = parseFloat(set.reps) || 0;
        return s + (set.done ? w * r : 0);
      }, 0)
    );
  }, 0);

  const totalSetsDone = exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.done).length,
    0
  );

  // --- Add exercise from picker ---
  const addExercise = (libItem: { name: string; muscle: string }) => {
    setExercises((prev) => [
      ...prev,
      {
        id: uid(),
        name: libItem.name,
        muscle: libItem.muscle,
        sets: [{ id: uid(), weight: '', reps: '', done: false }],
      },
    ]);
    setPickerVisible(false);
    setSearch('');
  };

  // --- Set management ---
  const addSet = (exId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
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
  };

  const updateSet = (exId: string, setId: string, field: 'weight' | 'reps', value: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id !== exId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
            }
      )
    );
  };

  const toggleSetDone = (exId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id !== exId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s) =>
                s.id === setId ? { ...s, done: !s.done } : s
              ),
            }
      )
    );
  };

  const removeSet = (exId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id !== exId ? ex : { ...ex, sets: ex.sets.filter((s) => s.id !== setId) }
      )
    );
  };

  const removeExercise = (exId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exId));
  };

  // --- Discard / Finish ---
  const handleDiscard = () => {
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
        },
      },
    ]);
  };

  const handleFinish = async () => {
    if (exercises.length === 0) {
      Alert.alert('Nothing to save', 'Add at least one exercise first.');
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'Please log in to save your workout.');
      return;
    }

    try {
      setSaving(true);
      setRunning(false);

      const cleanExercises = exercises
        .map((ex) => ({
          name: ex.name,
          muscle: ex.muscle,
          sets: ex.sets
            .filter((s) => s.done)
            .map((s) => ({ weight: s.weight, reps: s.reps })),
        }))
        .filter((ex) => ex.sets.length > 0);

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
        muscles: Array.from(new Set(cleanExercises.map((e) => e.muscle))),
        createdAt: serverTimestamp(),
      });

      setExercises([]);
      setSeconds(0);
      Alert.alert('Workout saved 💪', `Logged ${cleanExercises.length} exercise(s).`);
    } catch (error: any) {
      Alert.alert('Error saving workout', error.message);
      setRunning(true);
    } finally {
      setSaving(false);
    }
  };

  const filteredLibrary = EXERCISE_LIBRARY.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Workout</Text>
          {exercises.length > 0 && (
            <View style={styles.timerRow}>
              <Ionicons name="time-outline" size={14} color="#7c3aed" />
              <Text style={styles.timerText}>{formatTime(seconds)}</Text>
            </View>
          )}
        </View>
        {exercises.length > 0 && (
          <TouchableOpacity onPress={handleDiscard}>
            <Text style={styles.discardText}>Discard</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Live Stats Strip */}
      {exercises.length > 0 && (
        <View style={styles.statsStrip}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{exercises.length}</Text>
            <Text style={styles.statLabel}>Exercises</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalSetsDone}</Text>
            <Text style={styles.statLabel}>Sets done</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalVolume.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Volume (lb)</Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.feed} showsVerticalScrollIndicator={false}>
        {exercises.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>No exercises yet</Text>
            <Text style={styles.emptySub}>
              Tap "Add Exercise" below to start logging your workout
            </Text>
          </View>
        ) : (
          exercises.map((ex) => {
            const colors = muscleColors[ex.muscle] || { bg: '#f3f4f6', text: '#374151' };
            return (
              <View key={ex.id} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                    <View style={[styles.muscleTag, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.muscleTagText, { color: colors.text }]}>
                        {ex.muscle}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => removeExercise(ex.id)}>
                    <Ionicons name="trash-outline" size={18} color="#d1d5db" />
                  </TouchableOpacity>
                </View>

                {/* Set Column Headers */}
                <View style={styles.setHeaderRow}>
                  <Text style={[styles.setHeaderText, { width: 32 }]}>Set</Text>
                  <Text style={[styles.setHeaderText, { flex: 1 }]}>Weight (lb)</Text>
                  <Text style={[styles.setHeaderText, { flex: 1 }]}>Reps</Text>
                  <View style={{ width: 36 }} />
                </View>

                {ex.sets.map((set, idx) => (
                  <View key={set.id} style={[styles.setRow, set.done && styles.setRowDone]}>
                    <Text style={styles.setIndex}>{idx + 1}</Text>
                    <TextInput
                      style={styles.setInput}
                      value={set.weight}
                      onChangeText={(v) => updateSet(ex.id, set.id, 'weight', v)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#d1d5db"
                    />
                    <TextInput
                      style={styles.setInput}
                      value={set.reps}
                      onChangeText={(v) => updateSet(ex.id, set.id, 'reps', v)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#d1d5db"
                    />
                    <TouchableOpacity
                      style={[styles.checkBtn, set.done && styles.checkBtnActive]}
                      onPress={() => toggleSetDone(ex.id, set.id)}
                    >
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={set.done ? '#fff' : '#d1d5db'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeSetBtn}
                      onPress={() => removeSet(ex.id, set.id)}
                    >
                      <Ionicons name="close" size={14} color="#d1d5db" />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(ex.id)}>
                  <Ionicons name="add" size={16} color="#7c3aed" />
                  <Text style={styles.addSetText}>Add Set</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* Add Exercise Button */}
        <TouchableOpacity style={styles.addExerciseBtn} onPress={() => setPickerVisible(true)}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.addExerciseText}>Add Exercise</Text>
        </TouchableOpacity>

        {/* Finish Button */}
        {exercises.length > 0 && (
          <TouchableOpacity
            style={[styles.finishBtn, saving && styles.finishBtnDisabled]}
            onPress={handleFinish}
            disabled={saving}
          >
            <Text style={styles.finishText}>{saving ? 'Saving…' : 'Finish Workout'}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Exercise Picker Modal */}
      <Modal visible={pickerVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Exercise</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search exercises…"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <ScrollView style={styles.libraryList} showsVerticalScrollIndicator={false}>
              {filteredLibrary.map((item) => {
                const colors = muscleColors[item.muscle] || { bg: '#f3f4f6', text: '#374151' };
                return (
                  <TouchableOpacity
                    key={item.name}
                    style={styles.libraryRow}
                    onPress={() => addExercise(item)}
                  >
                    <Text style={styles.libraryName}>{item.name}</Text>
                    <View style={[styles.muscleTag, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.muscleTagText, { color: colors.text }]}>
                        {item.muscle}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {filteredLibrary.length === 0 && (
                <Text style={styles.noResults}>No exercises found</Text>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f7f4' },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a2e' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  timerText: { fontSize: 14, fontWeight: '700', color: '#7c3aed' },
  discardText: { fontSize: 14, color: '#e11d48', fontWeight: '600', marginTop: 8 },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: '#1e1b4b',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: '#c4b5fd', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Feed
  feed: { flex: 1, paddingHorizontal: 16 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 18 },

  // Exercise card
  exerciseCard: {
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
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  exerciseName: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', marginBottom: 6 },
  muscleTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  muscleTagText: { fontSize: 11, fontWeight: '600' },

  // Set rows
  setHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  setHeaderText: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 8,
  },
  setRowDone: { backgroundColor: '#f0fdf4' },
  setIndex: { width: 32, fontSize: 13, fontWeight: '700', color: '#6b7280', textAlign: 'center' },
  setInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    textAlign: 'center',
  },
  checkBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBtnActive: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  removeSetBtn: { width: 24, justifyContent: 'center', alignItems: 'center' },

  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    marginTop: 4,
    backgroundColor: '#f5f3ff',
    borderRadius: 10,
  },
  addSetText: { fontSize: 13, fontWeight: '600', color: '#7c3aed' },

  // Add exercise / finish buttons
  addExerciseBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e1b4b',
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 4,
    marginBottom: 12,
  },
  addExerciseText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  finishBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  finishBtnDisabled: { opacity: 0.6 },
  finishText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    height: '75%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 19, fontWeight: '800', color: '#1a1a2e' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a2e' },
  libraryList: { flex: 1 },
  libraryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  libraryName: { fontSize: 15, color: '#1a1a2e', fontWeight: '500', flex: 1 },
  noResults: { textAlign: 'center', color: '#9ca3af', marginTop: 30, fontSize: 14 },
});