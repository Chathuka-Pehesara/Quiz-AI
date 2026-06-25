import { useTheme } from '../context/ThemeContext';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { connectSocket, getSocket } from '../services/socket';

export default function BattleLobbyScreen({ route, navigation }) {
  const { colors, theme } = useTheme();
  const styles = getStyles(colors, theme);
  const { roomCode, quizId, user } = route.params; // If roomCode is null, we are the host. Otherwise we are the student joining
  const [currentCode, setCurrentCode] = useState(roomCode);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(!roomCode);

  useEffect(() => {
    // 1. Establish socket connection
    const socket = connectSocket(user.id, user.name);

    if (!socket) {
      Alert.alert('Socket Connection Error', 'Failed to connect to battle room server.');
      navigation.goBack();
      return;
    }

    // 2. Setup socket listners
    socket.on('room_created', ({ roomCode, roomData }) => {
      setCurrentCode(roomCode);
      setPlayers(roomData.players);
      setLoading(false);
    });

    socket.on('joined_successfully', ({ roomCode, roomData }) => {
      setCurrentCode(roomCode);
      setPlayers(roomData.players);
      setLoading(false);
    });

    socket.on('room_players_updated', (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    socket.on('battle_started', ({ question, currentIndex, totalQuestions }) => {
      // Navigate all players to active battle arena
      navigation.replace('Battle', {
        roomCode: currentCode || roomCode,
        initialQuestion: question,
        initialIndex: currentIndex,
        totalQuestions,
        user
      });
    });

    socket.on('error_message', (msg) => {
      Alert.alert('Lobby Error', msg);
      navigation.goBack();
    });

    // 3. Emit joining or creating events
    if (isHost) {
      socket.emit('create_room', { userId: user.id, name: user.name, quizId });
    } else {
      socket.emit('join_room', { roomCode, userId: user.id, name: user.name });
    }

    // Clean up
    return () => {
      socket.off('room_created');
      socket.off('joined_successfully');
      socket.off('room_players_updated');
      socket.off('battle_started');
      socket.off('error_message');
    };
  }, []);

  const handleStartBattle = () => {
    const socket = getSocket();
    if (socket && currentCode) {
      socket.emit('start_battle', { roomCode: currentCode });
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Connecting to lobby server...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isHost ? 'Hosting Quiz Battle' : 'Joined Quiz Battle'}</Text>
        <Text style={styles.headerSub}>Real-time Synchronous Classroom Mode</Text>
      </View>

      {/* Code Display */}
      <View style={styles.codeContainer}>
        <Text style={styles.codeLabel}>Share Room Code</Text>
        <Text style={styles.codeText}>{currentCode}</Text>
      </View>

      {/* Players List */}
      <Text style={styles.listTitle}>Waiting Room ({players.length} joined)</Text>
      <FlatList
        data={players}
        keyExtractor={(item) => item.userId}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item }) => (
          <View style={styles.playerCard}>
            <Text style={styles.avatarEmoji}>👤</Text>
            <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
            {item.userId === user.id && <Text style={styles.youBadge}>You</Text>}
          </View>
        )}
      />

      {/* Control Buttons */}
      <View style={styles.actions}>
        {isHost ? (
          <TouchableOpacity 
            activeOpacity={0.8}
            style={styles.startBtn}
            onPress={handleStartBattle}
            disabled={players.length === 0}
          >
            <Text style={styles.startBtnText}>Start Battle Arena</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.waitingContainer}>
            <ActivityIndicator size="small" color="#F59E0B" />
            <Text style={styles.waitingText}>Waiting for host to commence...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const getStyles = (colors, theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  headerSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  codeContainer: {
    backgroundColor: colors.card,
    borderColor: colors.primary,
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 30,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  codeLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  codeText: {
    color: colors.text,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 2,
  },
  listTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  listContent: {
    gap: 12,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    gap: 12,
  },
  playerCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    position: 'relative',
  },
  avatarEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  playerName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  youBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.primary,
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  actions: {
    marginVertical: 30,
  },
  startBtn: {
    backgroundColor: colors.teal,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.teal,
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  startBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  waitingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    height: 50,
    borderRadius: 12,
    borderColor: colors.border,
    borderWidth: 1,
  },
  waitingText: {
    color: colors.amber,
    fontSize: 13,
    fontWeight: '700',
  },
});
