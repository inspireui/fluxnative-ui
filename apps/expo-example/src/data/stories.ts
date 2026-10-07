export interface Story {
  id: string;
  tag: string;
  title: string;
  summary: string;
  image: string;
}

export const STORIES: Story[] = [
  {
    id: 'glass',
    tag: 'Design',
    title: 'Chrome is a layer, not a surface',
    summary: 'Navigation floats above content in its own glass layer. Content scrolls beneath it and stays readable.',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'tokens',
    tag: 'Tokens',
    title: 'One source, every platform',
    summary: 'DTCG tokens compile to TypeScript, a Uniwind theme and, next, native color assets.',
    image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'agents',
    tag: 'AI',
    title: 'Written for the model, too',
    summary: 'A small, closed vocabulary that a model can hold in an 8 KB index and that the linter can check.',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'a11y',
    tag: 'Accessibility',
    title: 'Glass that steps aside',
    summary: 'Reduce Transparency and Increase Contrast turn every custom glass surface opaque, live.',
    image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
  },
];
