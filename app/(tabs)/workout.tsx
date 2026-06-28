/**
 * WorkoutScreen.tsx — Upgraded Gym Tracker
 *
 * New features added on top of existing functionality:
 *  • Enriched exercise library (thumbnail, video, description, equipment,
 *    difficulty, primary/secondary muscles)
 *  • Hero-style exercise cards with 16:9 thumbnail + animated play button
 *  • Full-screen video detail modal with expo-av VideoView controls
 *  • Skeleton loading for thumbnails
 *  • Improved picker rows (thumbnail, difficulty, equipment)
 *  • Expanded search (name, muscle, equipment, difficulty)
 *
 * Preserved features:
 *  • Workout timer / rest timer
 *  • Add / remove sets, weight, reps, done toggle
 *  • Volume calculation
 *  • Finish workout → Firestore save (no URLs saved to history)
 *  • Discard workout
 *  • Muscle filter chips
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
  SafeAreaView,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { auth, db } from '../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
  icon: string; // emoji fallback
}

interface ExerciseEntry {
  id: string;
  libId: string;         // reference back to library
  name: string;
  muscle: string;
  sets: SetEntry[];
}

// ─────────────────────────────────────────────
// Cloudinary base URL — swap in your cloud name
// ─────────────────────────────────────────────
const CDN = 'https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload';
const CDN_VIDEO = 'https://res.cloudinary.com/YOUR_CLOUD_NAME/video/upload';

const img = (path: string) => `${CDN}/q_auto,f_auto,w_600/${path}`;
const vid = (path: string) => `${CDN_VIDEO}/q_auto/${path}`;

// ─────────────────────────────────────────────
// Enriched Exercise Library
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
  return <Animated.View style={[style, { opacity, backgroundColor: '#E5E7EB' }]} />;
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
// Video Detail Modal
// ─────────────────────────────────────────────
interface VideoModalProps {
  item: ExerciseLibItem | null;
  visible: boolean;
  onClose: () => void;
}

const VideoModal = memo(({ item, visible, onClose }: VideoModalProps) => {
  const player = useVideoPlayer(item?.video ?? '', p => {
    p.loop = false;
  });

  useEffect(() => {
    if (!visible) {
      player.pause();
    }
  }, [visible]);

  if (!item) return null;

  const muscleBg = muscleColors[item.muscle] ?? { bg: '#F3F4F6', text: '#374151' };
  const diffBg = difficultyColors[item.difficulty] ?? { bg: '#F3F4F6', text: '#374151' };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={vStyles.overlay}>
        {/* Dark tap-away area */}
        <TouchableOpacity style={vStyles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={vStyles.sheet}>
          {/* Video */}
          <View style={vStyles.videoWrap}>
            <VideoView
              player={player}
              style={vStyles.video}
              allowsFullscreen
              allowsPictureInPicture
              contentFit="cover"
            />
            {/* Close button overlay */}
            <TouchableOpacity style={vStyles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={vStyles.infoScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Title + badges */}
            <Text style={vStyles.title}>{item.name}</Text>
            <View style={vStyles.badgeRow}>
              <View style={[vStyles.badge, { backgroundColor: muscleBg.bg }]}>
                <Text style={[vStyles.badgeText, { color: muscleBg.text }]}>{item.muscle}</Text>
              </View>
              <View style={[vStyles.badge, { backgroundColor: diffBg.bg }]}>
                <Text style={[vStyles.badgeText, { color: diffBg.text }]}>{item.difficulty}</Text>
              </View>
              <View style={vStyles.equipBadge}>
                <Ionicons name="barbell-outline" size={12} color="#6B7280" style={{ marginRight: 4 }} />
                <Text style={vStyles.equipText}>{item.equipment}</Text>
              </View>
            </View>

            {/* Description */}
            <Text style={vStyles.sectionLabel}>About</Text>
            <Text style={vStyles.description}>{item.description}</Text>

            {/* Primary muscles */}
            {item.primaryMuscles.length > 0 && (
              <>
                <Text style={vStyles.sectionLabel}>Primary Muscles</Text>
                <View style={vStyles.muscleTagRow}>
                  {item.primaryMuscles.map(m => (
                    <View key={m} style={vStyles.muscleTag}>
                      <Text style={vStyles.muscleTagText}>{m}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Secondary muscles */}
            {item.secondaryMuscles.length > 0 && (
              <>
                <Text style={vStyles.sectionLabel}>Secondary Muscles</Text>
                <View style={vStyles.muscleTagRow}>
                  {item.secondaryMuscles.map(m => (
                    <View key={m} style={[vStyles.muscleTag, vStyles.muscleTagSecondary]}>
                      <Text style={[vStyles.muscleTagText, { color: '#6B7280' }]}>{m}</Text>
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
  // ── Workout state ──
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Picker state ──
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
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const totalVolume = exercises.reduce(
    (sum, ex) =>
      sum +
      ex.sets.reduce((s, set) => {
        const w = parseFloat(set.weight) || 0;
        const r = parseFloat(set.reps) || 0;
        return s + (set.done ? w * r : 0);
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

      // Only save name/sets — no image or video URLs
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

  const isActive = exercises.length > 0;
  const restProgress = restSeconds / REST_DURATION;

  // ── Open video ──
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
    <SafeAreaView style={s.safe}>

      {/* ── HERO HEADER ── */}
      <LinearGradient
        colors={isActive ? ['#1a0533', '#2d1060', '#3b0f8f'] : ['#1e1b4b', '#312e81']}
        style={s.hero}
      >
        <View style={s.heroTopRow}>
          <View>
            <Text style={s.heroLabel}>{isActive ? 'In Progress' : 'Workout'}</Text>
            {isActive ? (
              <Text style={s.heroTimer}>{formatTime(seconds)}</Text>
            ) : (
              <Text style={s.heroSubtitle}>Build your session</Text>
            )}
          </View>
          {isActive && (
            <TouchableOpacity onPress={handleDiscard} style={s.discardBtn}>
              <Text style={s.discardText}>Discard</Text>
            </TouchableOpacity>
          )}
        </View>

        {isActive && (
          <View style={s.heroStats}>
            <View style={s.heroStatItem}>
              <Text style={s.heroStatVal}>{exercises.length}</Text>
              <Text style={s.heroStatLabel}>Exercises</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStatItem}>
              <Text style={s.heroStatVal}>{totalSetsDone}</Text>
              <Text style={s.heroStatLabel}>Sets Done</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStatItem}>
              <Text style={s.heroStatVal}>
                {totalVolume > 0 ? totalVolume.toLocaleString() : '—'}
              </Text>
              <Text style={s.heroStatLabel}>Volume (kg)</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* ── REST TIMER BAR ── */}
      {restRunning && (
        <View style={s.restBar}>
          <View style={s.restBarFill}>
            <View style={[s.restProgress, { width: `${(1 - restProgress) * 100}%` as any }]} />
          </View>
          <View style={s.restBarContent}>
            <Ionicons name="timer-outline" size={14} color="#7C3AED" />
            <Text style={s.restBarText}>Rest  {formatTime(REST_DURATION - restSeconds)}</Text>
            <TouchableOpacity onPress={() => { setRestRunning(false); setRestSeconds(0); }}>
              <Text style={s.restSkip}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        style={s.feed}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── EMPTY STATE ── */}
        {!isActive && (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>🏋️</Text>
            <Text style={s.emptyTitle}>No exercises yet</Text>
            <Text style={s.emptySub}>Tap "Add Exercise" to start building your workout</Text>
          </View>
        )}

        {/* ── EXERCISE CARDS ── */}
        {exercises.map((ex, exIdx) => {
          const lib = getLibItem(ex.libId);
          const colors = muscleColors[ex.muscle] ?? { bg: '#F3F4F6', text: '#374151' };
          const diff = lib ? difficultyColors[lib.difficulty] ?? { bg: '#F3F4F6', text: '#374151' } : null;
          const completedSets = ex.sets.filter(s => s.done).length;
          const nextEx = exercises[exIdx + 1];
          const nextLib = nextEx ? getLibItem(nextEx.libId) : null;

          return (
            <View key={ex.id} style={s.exerciseCard}>

              {/* ── Thumbnail (16:9) with play button ── */}
              {lib && (
                <TouchableOpacity
                  style={s.thumbWrap}
                  activeOpacity={0.88}
                  onPress={() => openVideo(ex.libId)}
                >
                  <LazyImage uri={lib.thumbnail} style={s.thumb} />
                  {/* Dark gradient overlay */}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.55)']}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  {/* Animated play button */}
                  <View style={s.playBtnWrap}>
                    <View style={s.playBtn}>
                      <Ionicons name="play" size={18} color="#fff" style={{ marginLeft: 2 }} />
                    </View>
                    <Text style={s.playLabel}>Watch Form</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Card Header */}
              <View style={s.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardExName}>{ex.name}</Text>
                  <View style={s.cardMeta}>
                    <View style={[s.muscleChip, { backgroundColor: colors.bg }]}>
                      <Text style={[s.muscleChipText, { color: colors.text }]}>{ex.muscle}</Text>
                    </View>
                    {diff && lib && (
                      <View style={[s.muscleChip, { backgroundColor: diff.bg }]}>
                        <Text style={[s.muscleChipText, { color: diff.text }]}>{lib.difficulty}</Text>
                      </View>
                    )}
                    <Text style={s.cardSetCount}>{completedSets}/{ex.sets.length} sets</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => removeExercise(ex.id)}
                  style={s.removeExBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={17} color="#D1D5DB" />
                </TouchableOpacity>
              </View>

              {/* Column headers */}
              <View style={s.setColHeaders}>
                <Text style={[s.setColLabel, { width: 28 }]}>SET</Text>
                <Text style={[s.setColLabel, { flex: 1 }]}>KG</Text>
                <Text style={[s.setColLabel, { flex: 1 }]}>REPS</Text>
                <View style={{ width: 64 }} />
              </View>

              {/* Set rows */}
              {ex.sets.map((set, idx) => (
                <View key={set.id} style={[s.setRow, set.done && s.setRowDone]}>
                  <Text style={[s.setNum, set.done && s.setNumDone]}>{idx + 1}</Text>
                  <TextInput
                    style={[s.setInput, set.done && s.setInputDone]}
                    value={set.weight}
                    onChangeText={v => updateSet(ex.id, set.id, 'weight', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#D1D5DB"
                    editable={!set.done}
                  />
                  <TextInput
                    style={[s.setInput, set.done && s.setInputDone]}
                    value={set.reps}
                    onChangeText={v => updateSet(ex.id, set.id, 'reps', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#D1D5DB"
                    editable={!set.done}
                  />
                  <TouchableOpacity
                    style={[s.checkBtn, set.done && s.checkBtnDone]}
                    onPress={() => toggleSetDone(ex.id, set.id)}
                  >
                    <Ionicons name="checkmark" size={15} color={set.done ? '#fff' : '#9CA3AF'} />
                  </TouchableOpacity>
                  {!set.done ? (
                    <TouchableOpacity
                      onPress={() => removeSet(ex.id, set.id)}
                      style={s.removeSetBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={13} color="#D1D5DB" />
                    </TouchableOpacity>
                  ) : (
                    <View style={{ width: 24 }} />
                  )}
                </View>
              ))}

              {/* Add Set */}
              <TouchableOpacity style={s.addSetBtn} onPress={() => addSet(ex.id)}>
                <Ionicons name="add" size={15} color="#7C3AED" />
                <Text style={s.addSetText}>Add Set</Text>
              </TouchableOpacity>

              {/* Next Up preview */}
              {nextEx && (
                <View style={s.nextUpRow}>
                  <Text style={s.nextUpLabel}>Next up</Text>
                  {nextLib && (
                    <LazyImage uri={nextLib.thumbnail} style={s.nextUpThumb} />
                  )}
                  <Text style={s.nextUpName}>{nextEx.name}</Text>
                  <View
                    style={[
                      s.muscleChip,
                      {
                        backgroundColor:
                          (muscleColors[nextEx.muscle] ?? { bg: '#F3F4F6' }).bg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.muscleChipText,
                        { color: (muscleColors[nextEx.muscle] ?? { text: '#374151' }).text },
                      ]}
                    >
                      {nextEx.muscle}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* ── ADD EXERCISE BUTTON ── */}
        <TouchableOpacity
          style={s.addExBtn}
          onPress={() => setPickerVisible(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#4C1D95', '#6D28D9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.addExGrad}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={s.addExText}>Add Exercise</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── FINISH WORKOUT ── */}
        {isActive && (
          <TouchableOpacity
            style={[s.finishBtn, saving && { opacity: 0.6 }]}
            onPress={handleFinish}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={s.finishText}>{saving ? 'Saving…' : 'Finish Workout'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── EXERCISE PICKER MODAL ── */}
      <Modal visible={pickerVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modalOverlay}
        >
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />

            {/* Header */}
            <View style={s.modalHeaderRow}>
              <Text style={s.modalTitle}>Add Exercise</Text>
              <TouchableOpacity
                onPress={() => {
                  setPickerVisible(false);
                  setSearch('');
                  setMuscleFilter('All');
                }}
              >
                <View style={s.modalCloseBtn}>
                  <Ionicons name="close" size={18} color="#6B7280" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={s.searchBox}>
              <Ionicons name="search-outline" size={16} color="#9CA3AF" />
              <TextInput
                style={s.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Name, muscle, equipment, difficulty…"
                placeholderTextColor="#9CA3AF"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Muscle filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.filterRow}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
              {MUSCLE_FILTERS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[s.filterChip, muscleFilter === f && s.filterChipActive]}
                  onPress={() => setMuscleFilter(f)}
                >
                  <Text
                    style={[
                      s.filterChipText,
                      muscleFilter === f && s.filterChipTextActive,
                    ]}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Library list */}
            <FlatList
              data={filteredLibrary}
              keyExtractor={item => item.id}
              style={s.libraryList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                  <Text style={{ fontSize: 32, marginBottom: 10 }}>🔍</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 14 }}>No exercises found</Text>
                </View>
              }
              ListFooterComponent={<View style={{ height: 30 }} />}
              renderItem={({ item }) => {
                const colors = muscleColors[item.muscle] ?? { bg: '#F3F4F6', text: '#374151' };
                const diff = difficultyColors[item.difficulty] ?? { bg: '#F3F4F6', text: '#374151' };
                return (
                  <TouchableOpacity
                    style={s.libraryRow}
                    onPress={() => addExercise(item)}
                    activeOpacity={0.7}
                  >
                    {/* Thumbnail */}
                    <LazyImage uri={item.thumbnail} style={s.libraryThumb} />

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={s.libraryName}>{item.name}</Text>
                      <View style={s.libraryBadgeRow}>
                        <View style={[s.muscleChip, { backgroundColor: colors.bg }]}>
                          <Text style={[s.muscleChipText, { color: colors.text }]}>
                            {item.muscle}
                          </Text>
                        </View>
                        <View style={[s.muscleChip, { backgroundColor: diff.bg }]}>
                          <Text style={[s.muscleChipText, { color: diff.text }]}>
                            {item.difficulty}
                          </Text>
                        </View>
                      </View>
                      <View style={s.libraryEquipRow}>
                        <Ionicons name="barbell-outline" size={11} color="#9CA3AF" />
                        <Text style={s.libraryEquipText}>{item.equipment}</Text>
                      </View>
                    </View>

                    {/* Add button */}
                    <View style={s.libraryAddBtn}>
                      <Ionicons name="add" size={18} color="#7C3AED" />
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── VIDEO DETAIL MODAL ── */}
      <VideoModal
        item={videoItem}
        visible={videoVisible}
        onClose={() => setVideoVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Styles — main screen
// ─────────────────────────────────────────────
const s = StyleSheet.create({
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
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(196,181,253,0.85)', marginBottom: 4 },
  heroTimer: { fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  heroSubtitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  discardBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(225,29,72,0.18)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(225,29,72,0.3)',
  },
  discardText: { fontSize: 13, color: '#FB7185', fontWeight: '700' },
  heroStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 14,
  },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatVal: { fontSize: 19, fontWeight: '900', color: '#fff' },
  heroStatLabel: { fontSize: 10, color: 'rgba(196,181,253,0.8)', marginTop: 3 },
  heroStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 2,
  },

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
  restBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
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
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#6D28D9',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  // Thumbnail
  thumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#E5E7EB',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  thumb: { width: '100%', height: '100%' },
  playBtnWrap: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(124,58,237,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playLabel: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },

  // Card header (below thumbnail)
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    paddingBottom: 0,
  },
  cardExName: { fontSize: 16, fontWeight: '800', color: '#1a1a2e', marginBottom: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardSetCount: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  removeExBtn: { padding: 4 },

  // Column headers
  setColHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 8,
    gap: 8,
  },
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
    marginHorizontal: 14,
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
  setInputDone: {
    borderColor: '#BBF7D0',
    color: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
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
    marginHorizontal: 14,
    marginBottom: 14,
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
    marginHorizontal: 14,
    marginBottom: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  nextUpLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  nextUpThumb: { width: 32, height: 32, borderRadius: 8 },
  nextUpName: { fontSize: 13, fontWeight: '700', color: '#374151', flex: 1 },

  // Muscle / difficulty chips
  muscleChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  muscleChipText: { fontSize: 11, fontWeight: '700' },

  // Add exercise button
  addExBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  addExGrad: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
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
    height: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1a1a2e' },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a2e' },
  filterRow: { marginBottom: 12, flexGrow: 0 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  filterChipActive: { backgroundColor: '#7C3AED' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterChipTextActive: { color: '#fff' },
  libraryList: { flex: 1, paddingHorizontal: 16 },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  libraryThumb: { width: 60, height: 44, borderRadius: 10 },
  libraryName: { fontSize: 14, color: '#1a1a2e', fontWeight: '700', marginBottom: 4 },
  libraryBadgeRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  libraryEquipRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  libraryEquipText: { fontSize: 11, color: '#9CA3AF' },
  libraryAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ─────────────────────────────────────────────
// Styles — video modal
// ─────────────────────────────────────────────
const vStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: SCREEN_H * 0.92,
  },
  videoWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  video: { width: '100%', height: '100%' },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoScroll: { paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 20, fontWeight: '900', color: '#1a1a2e', marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  equipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  equipText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
  },
  description: { fontSize: 14, color: '#374151', lineHeight: 21 },
  muscleTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muscleTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EDE9FE',
    borderRadius: 20,
  },
  muscleTagSecondary: { backgroundColor: '#F3F4F6' },
  muscleTagText: { fontSize: 12, fontWeight: '600', color: '#5B21B6' },
});