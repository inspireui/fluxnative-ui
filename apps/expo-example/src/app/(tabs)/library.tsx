import React from 'react';
import { Text, View } from 'react-native';
import { AppBar, Screen } from '@flux-ui/core';
import { STORIES } from '../../data/stories';

export default function Library() {
  return (
    <Screen contentContainerClassName="gap-3 px-4 pb-8">
      <AppBar title="Library" />
      {[...STORIES, ...STORIES, ...STORIES].map((story, i) => (
        <View key={`${story.id}-${i}`} className="flex-row items-center gap-3 rounded-2xl bg-card p-4">
          <View className="size-10 items-center justify-center rounded-xl bg-secondary">
            <Text className="text-base font-bold text-secondary-foreground">{i + 1}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-card-foreground">{story.title}</Text>
            <Text className="text-sm text-muted-foreground">{story.tag}</Text>
          </View>
        </View>
      ))}
    </Screen>
  );
}
