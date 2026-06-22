import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// --- Date helpers ---
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

// Build the 7-day week strip centered around today
function buildWeekStrip(today: Date) {
  const days: Date[] = [];
  const startDay = today.getDay(); // 0=Sun
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - startDay);
  for (let i = 0; i < 7; i++) {
    days.push(new Date(weekStart.getTime() + i * ONE_DAY_MS));
  }
  return days;
}

// --- Greeting helper ---
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const today = useMemo(() => startOfDay(new Date()), []);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [workoutDays, setWorkoutDays] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showFullCalendar, setShowFullCalendar] = useState(false);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    loadWorkoutDays();
    // Pulse animation for CTA
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
        setWorkoutDays(days);
        const { streakDays, totalWorkouts } = computeStreakAndTotal(days, today);
        if (data.streak !== streakDays || data.totalWorkouts !== totalWorkouts) {
          setDoc(docRef, { streak: streakDays, totalWorkouts }, { merge: true }).catch(() => {});
        }
      }
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  };

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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── HERO HEADER ── */}
        <LinearGradient colors={['#1a0533', '#2d1060', '#3b0f8f']} style={styles.hero}>
          {/* Top row */}
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroGreeting}>{getGreeting()},</Text>
              <Text style={styles.heroName}>{firstName} 👋</Text>
            </View>
            <TouchableOpacity style={styles.avatarCircle} onPress={() => router.push('/profile')} activeOpacity={0.75}>
              <LinearGradient colors={['#8B5CF6', '#6D28D9']} style={styles.avatarGrad}>
                <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
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

          {/* Today toggle hint */}
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

        {/* ── TODAY'S SUMMARY (placeholder) ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Summary</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.sectionLink}>View all ›</Text>
            </TouchableOpacity>
          </View>
          {[
            { icon: '💪', label: 'Exercises', value: '—', color: '#EDE9FE' },
            { icon: '✅', label: 'Sets Done', value: '—', color: '#D1FAE5' },
            { icon: '⚡', label: 'Volume', value: '—', color: '#FEF3C7' },
            { icon: '⏱', label: 'Avg Duration', value: '—', color: '#E0F2FE' },
          ].map((item, i) => (
            <View key={i} style={styles.summaryRow}>
              <View style={[styles.summaryIcon, { backgroundColor: item.color }]}>
                <Text style={styles.summaryIconText}>{item.icon}</Text>
              </View>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
            </View>
          ))}
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
// week bubble size
const BUBBLE = Math.floor((width - 32 - 16 - 6 * 12) / 7);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F4F8' },
  scroll: { paddingBottom: 20 },

  // ── Hero ──
  hero: {
    paddingHorizontal: 20,
    paddingTop: 16,
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
  avatarCircle: { borderRadius: 24, overflow: 'hidden' },
  avatarGrad: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
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
  todayToggleDone: {
    backgroundColor: '#EDE9FE',
  },
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

  // ── Summary ──
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  summaryIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  summaryIconText: { fontSize: 16 },
  summaryLabel: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' },
  summaryValue: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },

  // ── CTA ──
  ctaWrap: { marginHorizontal: 16, marginTop: 6 },
  ctaBtn: {
    borderRadius: 16, paddingVertical: 17,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  ctaIcon: { color: '#fff', fontSize: 14, marginRight: 10 },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.4 },
});