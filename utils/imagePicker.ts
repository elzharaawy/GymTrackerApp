// utils/imagePicker.ts

import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

export const pickImage = async (): Promise<string | null> => {
  try {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow photo library access."
      );
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error) {
    console.error(error);
    Alert.alert("Error", "Unable to select image.");
    return null;
  }
};

export const takePhoto = async (): Promise<string | null> => {
  try {
    const permission =
      await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow camera access."
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error) {
    console.error(error);
    Alert.alert("Error", "Unable to open camera.");
    return null;
  }
};

export const chooseImage = (): Promise<string | null> => {
  return new Promise((resolve) => {
    Alert.alert(
      "Profile Photo",
      "Choose an option",
      [
        {
          text: "Camera",
          onPress: async () => resolve(await takePhoto()),
        },
        {
          text: "Gallery",
          onPress: async () => resolve(await pickImage()),
        },
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve(null),
        },
      ],
      {
        cancelable: true,
      }
    );
  });
};