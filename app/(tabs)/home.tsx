import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Welcome back 👋</Text>

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>+ Add Workout</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.secondaryButton]}>
        <Text style={styles.buttonText}>View History</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.logout}
        onPress={() => router.replace("/login")}
      >
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    padding: 24,
    paddingTop: 80,
  },
  welcome: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 32,
  },
  button: {
    backgroundColor: "#22c55e",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 14,
  },
  secondaryButton: {
    backgroundColor: "#334155",
  },
  buttonText: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600",
  },
  logout: {
    marginTop: "auto",
    alignItems: "center",
    paddingVertical: 14,
  },
  logoutText: {
    color: "#f87171",
    fontSize: 14,
  },
});