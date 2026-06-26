import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { auth, db, storage } from '../../firebaseConfig';
import {
  updateProfile,
  updateEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';

// --- Types ---
interface UserProfile {
  displayName: string;
  email: string;
  bio: string;
  fitnessGoal: string;
  weightUnit: 'lb' | 'kg';
  weeklyTarget: number;
}

const FITNESS_GOALS = [
  'Build Muscle',
  'Lose Weight',
  'Improve Endurance',
  'Stay Active',
  'Athletic Performance',
];

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  // Profile state
  const [profile, setProfile] = useState<UserProfile>({
    displayName: user?.displayName || '',
    email: user?.email || '',
    bio: '',
    fitnessGoal: 'Build Muscle',
    weightUnit: 'lb',
    weeklyTarget: 4,
  });
  const [photoURL, setPhotoURL] = useState<string | null>(user?.photoURL || null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [stats, setStats] = useState({ totalWorkouts: 0, streak: 0, joinedAt: '' });

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Notifications toggle
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // --- Load profile from Firestore ---
  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'users', user!.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({
          displayName: data.displayName || user!.displayName || '',
          email: user!.email || '',
          bio: data.bio || '',
          fitnessGoal: data.fitnessGoal || 'Build Muscle',
          weightUnit: data.weightUnit || 'lb',
          weeklyTarget: data.weeklyTarget || 4,
        });
        setPhotoURL(data.photoURL || user!.photoURL || null);
        setNotificationsEnabled(data.notificationsEnabled ?? true);
        setStats({
          totalWorkouts: data.totalWorkouts || 0,
          streak: data.streak || 0,
          joinedAt: data.joinedAt
            ? new Date(data.joinedAt.toDate()).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })
            : 'Recently',
        });
      } else {
        // Create profile document for new users
        await setDoc(docRef, {
          displayName: user!.displayName || '',
          email: user!.email || '',
          bio: '',
          fitnessGoal: 'Build Muscle',
          weightUnit: 'lb',
          weeklyTarget: 4,
          photoURL: null,
          notificationsEnabled: true,
          totalWorkouts: 0,
          streak: 0,
          joinedAt: serverTimestamp(),
        });
        setStats({ totalWorkouts: 0, streak: 0, joinedAt: 'Just now' });
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load profile: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Pick + upload profile photo ---
  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Please allow access to your photo library to set a profile picture.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // ✅ Fixed: replaces deprecated MediaTypeOptions.Images
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.length) return;

    await uploadPhoto(result.assets[0].uri);
  };

  // ✅ Fixed: use XMLHttpRequest instead of fetch() for reliable local file URI → blob conversion
  const uriToBlob = (uri: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new Error('Failed to convert URI to blob'));
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
  };

  const uploadPhoto = async (uri: string) => {
    if (!user) return;
    try {
      setUploadingPhoto(true);

      // ✅ Fixed: XMLHttpRequest handles file:// URIs correctly on both iOS & Android
      const blob = await uriToBlob(uri);

      // Upload to Firebase Storage at a per-user path
      const fileRef = storageRef(storage, `profile-photos/${user.uid}.jpg`);
      await uploadBytes(fileRef, blob);
      const downloadURL = await getDownloadURL(fileRef);

      // Update Firebase Auth + Firestore with the new URL
      await updateProfile(user, { photoURL: downloadURL });
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: downloadURL,
        updatedAt: serverTimestamp(),
      });

      setPhotoURL(downloadURL);
    } catch (error: any) {
      Alert.alert('Upload failed', error.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    Alert.alert('Remove Photo', 'Remove your profile picture?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setUploadingPhoto(true);
            if (user) {
              // Best-effort delete from Storage; ignore if it doesn't exist
              try {
                await deleteObject(storageRef(storage, `profile-photos/${user.uid}.jpg`));
              } catch {}
              await updateProfile(user, { photoURL: null });
              await updateDoc(doc(db, 'users', user.uid), {
                photoURL: null,
                updatedAt: serverTimestamp(),
              });
            }
            setPhotoURL(null);
          } catch (error: any) {
            Alert.alert('Error', error.message);
          } finally {
            setUploadingPhoto(false);
          }
        },
      },
    ]);
  };

  // --- Save profile ---
  const handleSave = async () => {
    if (!profile.displayName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    try {
      setSaving(true);
      // Update Firebase Auth display name
      await updateProfile(user!, { displayName: profile.displayName.trim() });

      // Update email if changed
      if (profile.email !== user!.email) {
        await updateEmail(user!, profile.email.trim());
      }

      // Update Firestore document
      const docRef = doc(db, 'users', user!.uid);
      await updateDoc(docRef, {
        displayName: profile.displayName.trim(),
        email: profile.email.trim(),
        bio: profile.bio,
        fitnessGoal: profile.fitnessGoal,
        weightUnit: profile.weightUnit,
        weeklyTarget: profile.weeklyTarget,
        notificationsEnabled,
        updatedAt: serverTimestamp(),
      });

      setIsEditing(false);
      Alert.alert('Saved', 'Your profile has been updated!');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        Alert.alert(
          'Please re-login',
          'Changing your email requires a recent login. Please sign out and sign back in, then try again.'
        );
      } else {
        Alert.alert('Error', error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  // --- Change Password ---
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }
    try {
      setChangingPassword(true);
      // Re-authenticate first
      const credential = EmailAuthProvider.credential(user!.email!, currentPassword);
      await reauthenticateWithCredential(user!, credential);
      // Then update password
      await updatePassword(user!, newPassword);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
      Alert.alert('Success', 'Password updated successfully!');
    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        Alert.alert('Error', 'Current password is incorrect');
      } else {
        Alert.alert('Error', error.message);
      }
    } finally {
      setChangingPassword(false);
    }
  };

  // --- Sign Out ---
  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          router.replace('/');
        },
      },
    ]);
  };

  // --- Delete Account ---
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const docRef = doc(db, 'users', user!.uid);
              await updateDoc(docRef, { deleted: true, deletedAt: serverTimestamp() });
              // Best-effort cleanup of stored photo
              try {
                await deleteObject(storageRef(storage, `profile-photos/${user!.uid}.jpg`));
              } catch {}
              await deleteUser(user!);
              router.replace('/');
            } catch (error: any) {
              if (error.code === 'auth/requires-recent-login') {
                Alert.alert(
                  'Please re-login',
                  'Deleting your account requires a recent login. Please sign out, sign back in, then try deleting again.'
                );
              } else {
                Alert.alert('Error', error.message);
              }
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e1b4b" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            style={[styles.editBtn, isEditing && styles.editBtnActive]}
            onPress={() => (isEditing ? handleSave() : setIsEditing(true))}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.editBtnText, isEditing && styles.editBtnTextActive]}>
                {isEditing ? 'Save' : 'Edit'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarLarge}
            onPress={isEditing ? handlePickPhoto : undefined}
            activeOpacity={isEditing ? 0.7 : 1}
          >
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color="#7c3aed" />
            ) : photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>
                {(profile.displayName || profile.email || '?').charAt(0).toUpperCase()}
              </Text>
            )}
            {isEditing && !uploadingPhoto && (
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditBadgeText}>✎</Text>
              </View>
            )}
          </TouchableOpacity>

          {isEditing && (
            <View style={styles.photoActions}>
              <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto}>
                <Text style={styles.photoActionText}>Change Photo</Text>
              </TouchableOpacity>
              {photoURL && (
                <>
                  <Text style={styles.photoActionDivider}>·</Text>
                  <TouchableOpacity onPress={handleRemovePhoto} disabled={uploadingPhoto}>
                    <Text style={styles.photoActionTextDanger}>Remove</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {!isEditing && (
            <View style={styles.nameBlock}>
              <Text style={styles.profileName}>{profile.displayName || 'Your Name'}</Text>
              <Text style={styles.profileEmail}>{profile.email}</Text>
              <Text style={styles.profileJoined}>Member since {stats.joinedAt}</Text>
            </View>
          )}
        </View>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          {[
            { label: 'Workouts', value: stats.totalWorkouts },
            { label: 'Week Streak', value: `${stats.streak}🔥` },
            { label: 'Weekly Goal', value: `${profile.weeklyTarget}/wk` },
          ].map((s) => (
            <View key={s.label} style={styles.statItem}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Personal Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Info</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Name</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={profile.displayName}
                onChangeText={(v) => setProfile((p) => ({ ...p, displayName: v }))}
                placeholder="Your name"
                placeholderTextColor="#9ca3af"
              />
            ) : (
              <Text style={styles.fieldValue}>{profile.displayName || '—'}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={profile.email}
                onChangeText={(v) => setProfile((p) => ({ ...p, email: v }))}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="your@email.com"
                placeholderTextColor="#9ca3af"
              />
            ) : (
              <Text style={styles.fieldValue}>{profile.email || '—'}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Bio</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={profile.bio}
                onChangeText={(v) => setProfile((p) => ({ ...p, bio: v }))}
                placeholder="Tell your gym buddies about yourself…"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
              />
            ) : (
              <Text style={styles.fieldValue}>{profile.bio || 'No bio yet.'}</Text>
            )}
          </View>
        </View>

        {/* Fitness Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fitness Settings</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Fitness Goal</Text>
            {isEditing ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.goalPills}>
                  {FITNESS_GOALS.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.goalPill, profile.fitnessGoal === g && styles.goalPillActive]}
                      onPress={() => setProfile((p) => ({ ...p, fitnessGoal: g }))}
                    >
                      <Text style={[styles.goalPillText, profile.fitnessGoal === g && styles.goalPillTextActive]}>
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.goalBadge}>
                <Text style={styles.goalBadgeText}>{profile.fitnessGoal}</Text>
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Weight Unit</Text>
            {isEditing ? (
              <View style={styles.unitToggle}>
                {(['lb', 'kg'] as const).map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    style={[styles.unitBtn, profile.weightUnit === unit && styles.unitBtnActive]}
                    onPress={() => setProfile((p) => ({ ...p, weightUnit: unit }))}
                  >
                    <Text style={[styles.unitBtnText, profile.weightUnit === unit && styles.unitBtnTextActive]}>
                      {unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.fieldValue}>{profile.weightUnit}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Weekly Workout Target</Text>
            {isEditing ? (
              <View style={styles.targetRow}>
                {[2, 3, 4, 5, 6, 7].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.targetBtn, profile.weeklyTarget === n && styles.targetBtnActive]}
                    onPress={() => setProfile((p) => ({ ...p, weeklyTarget: n }))}
                  >
                    <Text style={[styles.targetBtnText, profile.weeklyTarget === n && styles.targetBtnTextActive]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.fieldValue}>{profile.weeklyTarget} days/week</Text>
            )}
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Workout Reminders</Text>
              <Text style={styles.toggleSub}>Get notified to hit your weekly goal</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={(v) => {
                setNotificationsEnabled(v);
                if (!isEditing) {
                  updateDoc(doc(db, 'users', user!.uid), { notificationsEnabled: v });
                }
              }}
              trackColor={{ false: '#e5e7eb', true: '#7c3aed' }}
              thumbColor={notificationsEnabled ? '#1e1b4b' : '#9ca3af'}
            />
          </View>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <TouchableOpacity
            style={styles.securityBtn}
            onPress={() => setShowPasswordSection(!showPasswordSection)}
          >
            <Text style={styles.securityBtnText}>🔐 Change Password</Text>
            <Text style={styles.chevron}>{showPasswordSection ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showPasswordSection && (
            <View style={styles.passwordSection}>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Current password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
              />
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password (min 6 chars)"
                placeholderTextColor="#9ca3af"
                secureTextEntry
              />
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
              />
              <TouchableOpacity
                style={styles.passwordSaveBtn}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.passwordSaveBtnText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>↩  Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
            <Text style={styles.deleteText}>🗑  Delete Account</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f7f4' },
  container: { flex: 1, paddingHorizontal: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f7f4' },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 14 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1a1a2e' },
  editBtn: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 64,
    alignItems: 'center',
  },
  editBtnActive: { backgroundColor: '#1e1b4b' },
  editBtnText: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  editBtnTextActive: { color: '#fff' },

  // Avatar
  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#ede9fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    overflow: 'visible',
  },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarInitial: { fontSize: 36, fontWeight: '800', color: '#7c3aed' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e1b4b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f8f7f4',
  },
  avatarEditBadgeText: { color: '#fff', fontSize: 12 },
  photoActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  photoActionText: { fontSize: 13, color: '#7c3aed', fontWeight: '600' },
  photoActionTextDanger: { fontSize: 13, color: '#e11d48', fontWeight: '600' },
  photoActionDivider: { fontSize: 13, color: '#d1d5db' },
  nameBlock: { alignItems: 'center', gap: 2 },
  profileName: { fontSize: 22, fontWeight: '800', color: '#1a1a2e' },
  profileEmail: { fontSize: 14, color: '#6b7280' },
  profileJoined: { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#1e1b4b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: '#c4b5fd', marginTop: 3 },

  // Section
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },

  // Field
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, color: '#9ca3af', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { fontSize: 15, color: '#1a1a2e', fontWeight: '500' },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  inputMultiline: { height: 80, textAlignVertical: 'top' },

  // Goal pills
  goalPills: { flexDirection: 'row', gap: 8 },
  goalPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  goalPillActive: { backgroundColor: '#ede9fe', borderColor: '#7c3aed' },
  goalPillText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  goalPillTextActive: { color: '#7c3aed', fontWeight: '700' },
  goalBadge: { alignSelf: 'flex-start', backgroundColor: '#ede9fe', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  goalBadgeText: { fontSize: 13, color: '#7c3aed', fontWeight: '600' },

  // Unit toggle
  unitToggle: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 10, padding: 3, alignSelf: 'flex-start' },
  unitBtn: { paddingHorizontal: 24, paddingVertical: 8, borderRadius: 8 },
  unitBtnActive: { backgroundColor: '#1e1b4b' },
  unitBtnText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  unitBtnTextActive: { color: '#fff' },

  // Weekly target
  targetRow: { flexDirection: 'row', gap: 8 },
  targetBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetBtnActive: { backgroundColor: '#1e1b4b' },
  targetBtnText: { fontSize: 15, color: '#6b7280', fontWeight: '600' },
  targetBtnTextActive: { color: '#fff' },

  // Notifications toggle
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontSize: 15, color: '#1a1a2e', fontWeight: '600' },
  toggleSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  // Security
  securityBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  securityBtnText: { fontSize: 15, color: '#1a1a2e', fontWeight: '600' },
  chevron: { color: '#9ca3af', fontSize: 12 },
  passwordSection: { marginTop: 14, gap: 4 },
  passwordSaveBtn: {
    backgroundColor: '#1e1b4b',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  passwordSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Account actions
  signOutBtn: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  signOutText: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  deleteBtn: {
    backgroundColor: '#fff1f2',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  deleteText: { fontSize: 15, fontWeight: '600', color: '#e11d48' },
});