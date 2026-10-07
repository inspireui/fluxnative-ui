import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppBar, Screen, usePalette } from '@fluxnative/ui';
import { Glyph } from '../../components/Glyph';
import { STORIES } from '../../data/stories';

export default function Discover() {
  const palette = usePalette();
  return (
    <Screen contentContainerClassName="gap-4 px-4 pb-8">
      <AppBar title="Discover" largeTitle>
        <AppBar.Trailing>
          <AppBar.Action
            label="Search"
            icon={<Glyph name="search" color={palette.foreground} />}
            onPress={() => router.push('/detail')}
          />
        </AppBar.Trailing>
      </AppBar>

      <View className="gap-1 pt-2">
        <Text className="text-sm font-medium text-muted-foreground">Tuesday, October 7</Text>
        <Text className="text-3xl font-bold text-foreground">Scroll under the glass</Text>
      </View>

      {STORIES.map((story) => (
        <Pressable
          key={story.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/detail', params: { id: story.id } })}
          className="overflow-hidden rounded-3xl bg-card"
        >
          <Image source={{ uri: story.image }} className="aspect-video w-full" resizeMode="cover" />
          <View className="gap-1 p-4">
            <Text className="text-xs font-semibold uppercase text-primary">{story.tag}</Text>
            <Text className="text-lg font-semibold text-card-foreground">{story.title}</Text>
            <Text className="text-sm text-muted-foreground" numberOfLines={2}>
              {story.summary}
            </Text>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
