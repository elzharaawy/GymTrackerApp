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
import { useRouter } from 'expo-router';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const { width } = Dimensions.get('window');
const CELL_SIZE = (width - 32 - 32 - 6 * 6) / 7; // container padding + card padding + gaps

// --- Date helpers ---
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateKey(date: Date) {
  // local YYYY-MM-DD, used as the Firestore field key for each day
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

// Build a month grid (weeks of 7) for the given year/month, padded with
// leading/trailing nulls so it lines up under the weekday header.
function buildMonthGrid(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay(); // 0 = Sunday

  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// Compute current streak (consecutive days ending today, or yesterday if
// today isn't logged yet) and total logged days from a workoutDays map.
function computeStreakAndTotal(workoutDays: Record<string, boolean>, today: Date) {
  const totalWorkouts = Object.values(workoutDays).filter(Boolean).length;

  let streakDays = 0;
  const cursor = new Date(today);
  if (!workoutDays[toDateKey(cursor)]) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (workoutDays[toDateKey(cursor)]) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { streakDays, totalWorkouts };
}

// --- Component ---
export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const today = useMemo(() => startOfDay(new Date()), []);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [workoutDays, setWorkoutDays] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Calendar month being viewed; starts on the current month
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    loadWorkoutDays();
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
        setWorkoutDays(days);

        // Reconcile stored streak/total in case a day passed since the
        // last write and the streak broke without the user opening the app.
        const { streakDays, totalWorkouts } = computeStreakAndTotal(days, today);
        if (data.streak !== streakDays || data.totalWorkouts !== totalWorkouts) {
          setDoc(
            docRef,
            { streak: streakDays, totalWorkouts },
            { merge: true }
          ).catch((err) => console.warn('Failed to reconcile streak', err));
        }
      }
    } catch (error) {
      console.warn('Failed to load workout days', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleToday = async () => {
    if (!user) return;
    const key = toDateKey(today);
    const next = !workoutDays[key];
    const updatedDays = { ...workoutDays, [key]: next };

    // Recompute streak + total against the post-toggle data so Firestore
    // always stores the up-to-date numbers, not last render's values.
    const { streakDays, totalWorkouts } = computeStreakAndTotal(updatedDays, today);

    // Optimistic update
    setWorkoutDays(updatedDays);
    setSaving(true);

    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(
        docRef,
        {
          workoutDays: { [key]: next },
          streak: streakDays,
          totalWorkouts,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      // Revert on failure
      setWorkoutDays((prev) => ({ ...prev, [key]: !next }));
      console.warn('Failed to save workout day', error);
    } finally {
      setSaving(false);
    }
  };

  // --- Derived stats ---
  const stats = useMemo(() => {
    const { streakDays, totalWorkouts } = computeStreakAndTotal(workoutDays, today);

    // This week's count (Sun–Sat)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    let thisWeek = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart.getTime() + i * ONE_DAY_MS);
      if (d <= today && workoutDays[toDateKey(d)]) thisWeek += 1;
    }

    return {
      totalWorkouts,
      streakDays,
      streakWeeks: Math.floor(streakDays / 7),
      thisWeek,
    };
  }, [workoutDays, today]);

  const monthWeeks = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const isCurrentMonthView = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello {displayName || 'there'} 👋</Text>
            <Text style={styles.subGreeting}>Ready to crush today?</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={() => router.push('/profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.avatarText}>
              {(displayName || user?.email || '?').charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Personal Stats Summary */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalWorkouts}</Text>
            <Text style={styles.statLabel}>Total Days</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.thisWeek}/7</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.streakDays}🔥</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
        </View>

        {/* Calendar */}
        <View style={styles.card}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={goToPrevMonth} style={styles.monthNavBtn}>
              <Text style={styles.monthNavText}>‹</Text>
            </TouchableOpacity>
            <View style={styles.monthTitleRow}>
              <Text style={styles.cardTitle}>
                {MONTH_LABELS[viewMonth]} {viewYear}
              </Text>
              {loading && <ActivityIndicator size="small" color="#7c3aed" style={{ marginLeft: 8 }} />}
            </View>
            <TouchableOpacity onPress={goToNextMonth} style={styles.monthNavBtn}>
              <Text style={styles.monthNavText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Weekday header */}
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <View key={i} style={styles.weekdayCell}>
                <Text style={styles.weekdayText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Month grid */}
          {monthWeeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) => {
                if (!day) {
                  return <View key={di} style={styles.dayCell} />;
                }
                const key = toDateKey(day);
                const done = !!workoutDays[key];
                const isToday = isSameDay(day, today);
                const isFuture = day > today;

                return (
                  <TouchableOpacity
                    key={di}
                    disabled={!isToday}
                    onPress={toggleToday}
                    activeOpacity={isToday ? 0.6 : 1}
                    style={[
                      styles.dayCell,
                      styles.dayCellBox,
                      done && styles.dayCellDone,
                      isToday && !done && styles.dayCellTodayOutline,
                      isFuture && styles.dayCellFuture,
                    ]}
                  >
                    {isToday && saving ? (
                      <ActivityIndicator size="small" color={done ? '#fff' : '#7c3aed'} />
                    ) : (
                      <Text
                        style={[
                          styles.dayNumber,
                          done && styles.dayNumberDone,
                          isToday && !done && styles.dayNumberToday,
                          isFuture && !done && styles.dayNumberFuture,
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    )}
                    {done && <Text style={styles.checkMark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <View style={styles.streakRow}>
            <Text style={styles.streakLabel}>Current streak:</Text>
            <Text style={styles.streakValue}>
              {' '}
              {stats.streakWeeks > 0
                ? `${stats.streakWeeks} week${stats.streakWeeks > 1 ? 's' : ''} 🔥`
                : stats.streakDays > 0
                ? `${stats.streakDays} day${stats.streakDays > 1 ? 's' : ''} 🔥`
                : 'Start today!'}
            </Text>
          </View>
          {isCurrentMonthView && (
            <Text style={styles.hintText}>Tap today's date to mark it as a workout day</Text>
          )}
        </View>

        {/* Start Workout CTA */}
        <TouchableOpacity style={styles.ctaButton} activeOpacity={0.85}>
          <Text style={styles.ctaText}>Start Blank Workout</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f7f4' },
  container: { flex: 1, paddingHorizontal: 16 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
  },
  greeting: { fontSize: 24, fontWeight: '700', color: '#1a1a2e' },
  subGreeting: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e1b4b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },

  // Personal stats bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#1e1b4b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 2 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: '#c4b5fd', marginTop: 3 },

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
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },

  // Calendar header / nav
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthTitleRow: { flexDirection: 'row', alignItems: 'center' },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthNavText: { fontSize: 18, color: '#1a1a2e', fontWeight: '700' },

  // Weekday header
  weekdayRow: { flexDirection: 'row', marginBottom: 6 },
  weekdayCell: { width: CELL_SIZE, alignItems: 'center' },
  weekdayText: { fontSize: 11, fontWeight: '700', color: '#9ca3af' },

  // Month grid
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellBox: {
    borderRadius: CELL_SIZE / 4,
    backgroundColor: 'transparent',
  },
  dayCellDone: {
    backgroundColor: '#7c3aed',
  },
  dayCellTodayOutline: {
    borderWidth: 2,
    borderColor: '#7c3aed',
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  dayCellFuture: {
    opacity: 0.4,
  },
  dayNumber: { fontSize: 13, fontWeight: '600', color: '#374151' },
  dayNumberDone: { color: '#fff', fontWeight: '700' },
  dayNumberToday: { color: '#7c3aed', fontWeight: '800' },
  dayNumberFuture: { color: '#9ca3af' },
  checkMark: {
    position: 'absolute',
    bottom: 1,
    right: 3,
    fontSize: 9,
    color: '#fff',
    fontWeight: '900',
  },

  streakRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  streakLabel: { fontSize: 13, color: '#6b7280' },
  streakValue: { fontSize: 13, fontWeight: '600', color: '#1a1a2e' },
  hintText: { fontSize: 11, color: '#9ca3af', marginTop: 8 },

  // CTA
  ctaButton: {
    backgroundColor: '#1e1b4b',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});