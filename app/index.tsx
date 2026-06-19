import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function WelcomeScreen() {
  // useRouter gives us a way to navigate to other files in app/
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏋️ Gym Tracker</Text>
      <Text style={styles.subtitle}>Track workouts. Build consistency.</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/login")}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/signup")}>
        <Text style={styles.link}>Don't have an account? Sign up</Text>
      </TouchableOpacity>
    </View>
  );
}

// StyleSheet.create is RN's way of defining styles as JS objects.
// No CSS files, no className — just camelCase properties.
const styles = StyleSheet.create({
  container: {
    flex: 1, // fill the whole screen
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#94a3b8",
    marginBottom: 40,
  },
  button: {
    backgroundColor: "#22c55e",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginBottom: 16,
  },
  buttonText: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600",
  },
  link: {
    color: "#60a5fa",
    fontSize: 14,
  },
});