import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

const EMOJIS = ['🐶', '🍕', '🚀', '🎸', '🌵', '🍩', '⚽', '🦄'];

type Card = { id: number; emoji: string; matched: boolean };

function createDeck(): Card[] {
  const deck = [...EMOJIS, ...EMOJIS].map((emoji, i) => ({ id: i, emoji, matched: false }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export default function GameScreen() {
  const { colors } = useTheme();
  const [cards, setCards] = useState<Card[]>(createDeck);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeout.current) clearTimeout(timeout.current);
  }, []);

  const won = cards.every((c) => c.matched);

  const restart = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    setCards(createDeck());
    setFlipped([]);
    setMoves(0);
  }, []);

  const onPress = (index: number) => {
    const card = cards[index];
    if (flipped.length === 2 || flipped.includes(index) || card.matched) return;

    const next = [...flipped, index];
    setFlipped(next);
    if (next.length < 2) return;

    setMoves((m) => m + 1);
    const [a, b] = next;
    if (cards[a].emoji === cards[b].emoji) {
      setCards((prev) => prev.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)));
      setFlipped([]);
    } else {
      timeout.current = setTimeout(() => setFlipped([]), 800);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Memory Match</Text>
      <Text style={[styles.moves, { color: colors.textSecondary }]}>Moves: {moves}</Text>
      <View style={styles.grid}>
        {cards.map((card, i) => {
          const visible = card.matched || flipped.includes(i);
          return (
            <Pressable
              key={card.id}
              onPress={() => onPress(i)}
              style={[
                styles.card,
                { backgroundColor: colors.placeholder },
                visible && [styles.cardVisible, { backgroundColor: colors.background }],
                card.matched && styles.cardMatched,
              ]}
              accessibilityLabel={visible ? card.emoji : 'Hidden card'}
            >
              <Text style={styles.emoji}>{visible ? card.emoji : '?'}</Text>
            </Pressable>
          );
        })}
      </View>
      {won && <Text style={[styles.win, { color: colors.text }]}>🎉 You won in {moves} moves!</Text>}
      <Pressable style={[styles.button, { backgroundColor: colors.text }]} onPress={restart}>
        <Text style={[styles.buttonText, { color: colors.background }]}>{won ? 'Play again' : 'Restart'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  moves: { marginVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 4 * 76, justifyContent: 'center' },
  card: {
    width: 70,
    height: 70,
    margin: 3,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardVisible: { borderWidth: 2, borderColor: '#999' },
  cardMatched: { borderColor: '#4caf50', opacity: 0.7 },
  emoji: { fontSize: 32 },
  win: { marginTop: 12, fontSize: 18, fontWeight: '600' },
  button: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  buttonText: { fontWeight: '600' },
});
