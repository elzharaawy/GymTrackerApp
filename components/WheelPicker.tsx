// components/WheelPicker.tsx
// Simple vertical wheel picker (used for Age). Snaps to items, highlights
// the centered value, and fades out-of-focus rows.

import React, { useCallback, useRef } from "react";
import { View, Text, StyleSheet, FlatList, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { colors, radii, typography } from "../constants/theme";

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface WheelPickerProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}

export default function WheelPicker({ min, max, value, onChange }: WheelPickerProps) {
  const data = useRef(
    Array.from({ length: max - min + 1 }, (_, i) => min + i)
  ).current;
  const listRef = useRef<FlatList<number>>(null);

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(data.length - 1, index));
      onChange(data[clamped]);
    },
    [data, onChange]
  );

  const initialIndex = Math.max(0, value - min);

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.highlight} />
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item) => String(item)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        contentContainerStyle={{
          paddingVertical: (PICKER_HEIGHT - ITEM_HEIGHT) / 2,
        }}
        onMomentumScrollEnd={handleMomentumEnd}
        renderItem={({ item }) => {
          const active = item === value;
          return (
            <View style={styles.item}>
              <Text style={[styles.itemText, active && styles.itemTextActive]}>{item}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: PICKER_HEIGHT,
    width: 140,
    alignSelf: "center",
  },
  highlight: {
    position: "absolute",
    top: ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    ...typography.subtitle,
    fontSize: 20,
    color: colors.textMuted,
  },
  itemTextActive: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 24,
  },
});