import React from 'react';
import { Image, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar, Glass, Screen } from '@flux-ui/core';
import { STORIES } from '../data/stories';

export default function Detail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const story = STORIES.find((s) => s.id === id) ?? STORIES[0];
  if (!story) return null;

  return (
    <Screen contentContainerClassName="pb-12">
      <AppBar title={story.tag} onBack={router.back} variant="clear" />
      <Image source={{ uri: story.image }} className="h-96 w-full" resizeMode="cover" />
      <View className="-mt-16 px-4">
        <Glass.Surface radius={28}>
          <View className="gap-2 p-5">
            <Text className="text-2xl font-bold text-foreground">{story.title}</Text>
            <Text className="text-base text-muted-foreground">{story.summary}</Text>
          </View>
        </Glass.Surface>
      </View>
      <View className="gap-3 px-4 pt-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Text key={i} className="text-base text-foreground">
            Content keeps scrolling under the bar so you can see the scroll-edge treatment and the glass reading
            whatever passes beneath it. Paragraph {i + 1}.
          </Text>
        ))}
      </View>
    </Screen>
  );
}
