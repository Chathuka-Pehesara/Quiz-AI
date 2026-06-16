const Quiz = require('../models/Quiz');
const rooms = require('./roomsStore');

module.exports = (io) => {

  // Helper to generate 6-digit code
  const generateRoomCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join Course Activity Feed Room
    socket.on('join_course_feed', ({ courseId }) => {
      socket.join(courseId);
      console.log(`Socket ${socket.id} joined course feed: ${courseId}`);
    });

    // Join Group Chat Room
    socket.on('join_group_chat', ({ groupId }) => {
      socket.join(groupId);
      console.log(`Socket ${socket.id} joined group chat room: ${groupId}`);
    });

    // Send Group Message
    socket.on('send_group_message', async ({ groupId, senderId, text }) => {
      try {
        const Message = require('../models/Message');
        const Group = require('../models/Group');
        const User = require('../models/User');

        const user = await User.findById(senderId);
        const group = await Group.findById(groupId);
        if (!group || !user) return;

        const message = new Message({
          group: groupId,
          sender: senderId,
          text
        });
        await message.save();

        io.to(groupId).emit('group_message_received', {
          _id: message._id,
          text: message.text,
          sender: { _id: user._id, name: user.name },
          createdAt: message.createdAt
        });
      } catch (e) {
        console.error('Group chat socket error:', e);
      }
    });

    // Create a new battle room
    socket.on('create_room', async ({ userId, name, quizId }) => {
      try {
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
          socket.emit('error_message', 'Quiz not found');
          return;
        }

        const roomCode = generateRoomCode();
        const roomData = {
          roomCode,
          quizId,
          quizTitle: quiz.title,
          questions: quiz.questions,
          hostId: userId,
          players: [{ socketId: socket.id, userId, name, score: 0 }],
          status: 'lobby', // lobby, playing, ended
          currentQuestionIndex: 0,
          answersReceived: {} // userId -> { isCorrect }
        };

        rooms.set(roomCode, roomData);
        socket.join(roomCode);
        
        console.log(`Room created: ${roomCode} by host: ${name}`);
        socket.emit('room_created', { roomCode, roomData });

        // Broadcast to Course Activity Feed
        io.to(quiz.course.toString()).emit('activity_feed_event', {
          type: 'battle_created',
          studentName: name,
          quizTitle: quiz.title,
          roomCode,
          createdAt: new Date()
        });
      } catch (err) {
        console.error(err);
        socket.emit('error_message', 'Failed to create room: ' + err.message);
      }
    });

    // Join an existing room
    socket.on('join_room', ({ roomCode, userId, name }) => {
      const room = rooms.get(roomCode);
      if (!room) {
        socket.emit('error_message', 'Room not found. Check the code and try again.');
        return;
      }

      if (room.status !== 'lobby') {
        socket.emit('error_message', 'Quiz battle has already started.');
        return;
      }

      // Check if user is already in the room
      const exists = room.players.find(p => p.userId === userId);
      if (!exists) {
        room.players.push({ socketId: socket.id, userId, name, score: 0 });
      } else {
        exists.socketId = socket.id; // Update socket ID
      }

      socket.join(roomCode);
      console.log(`Player ${name} joined room: ${roomCode}`);
      
      // Notify all users in the room
      io.to(roomCode).emit('room_players_updated', room.players);
      socket.emit('joined_successfully', { roomCode, roomData: room });
    });

    // Start the quiz battle
    socket.on('start_battle', ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room) return;

      if (room.status !== 'lobby') return;

      room.status = 'playing';
      room.currentQuestionIndex = 0;
      room.answersReceived = {};

      console.log(`Starting battle in room: ${roomCode}`);
      io.to(roomCode).emit('battle_started', {
        question: room.questions[0],
        currentIndex: 0,
        totalQuestions: room.questions.length
      });
    });

    // Submit answer for current question
    socket.on('submit_battle_answer', ({ roomCode, userId, isCorrect }) => {
      const room = rooms.get(roomCode);
      if (!room || room.status !== 'playing') return;

      // Avoid double submission
      if (room.answersReceived[userId]) return;

      room.answersReceived[userId] = { isCorrect };

      // Update player score
      const player = room.players.find(p => p.userId === userId);
      if (player && isCorrect) {
        player.score += 10; // 10 points per correct answer
      }

      // Check if all players have answered
      const activeAnswerCount = Object.keys(room.answersReceived).length;
      if (activeAnswerCount >= room.players.length) {
        // All players answered! Transition to score preview
        sendQuestionResult(roomCode);
      }
    });

    // Handle disconnecting players
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      // Clean up player from rooms
      rooms.forEach((room, roomCode) => {
        const index = room.players.findIndex(p => p.socketId === socket.id);
        if (index !== -1) {
          const leavingPlayer = room.players[index];
          console.log(`Player ${leavingPlayer.name} disconnected from room: ${roomCode}`);
          room.players.splice(index, 1);
          
          if (room.players.length === 0) {
            // Remove room if empty
            rooms.delete(roomCode);
            console.log(`Room ${roomCode} deleted as it became empty`);
          } else {
            // Update other players
            io.to(roomCode).emit('room_players_updated', room.players);
            
            // If we are currently playing and the leaving player was the last one we were waiting for
            if (room.status === 'playing') {
              delete room.answersReceived[leavingPlayer.userId];
              const activeAnswerCount = Object.keys(room.answersReceived).length;
              if (activeAnswerCount >= room.players.length) {
                sendQuestionResult(roomCode);
              }
            }
          }
        }
      });
    });
  });

  // Helper: Broadcast question results and leaderboard, then schedule next question
  function sendQuestionResult(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;

    // Build leaderboard sorted by score descending
    const leaderboard = [...room.players].sort((a, b) => b.score - a.score);

    // Correct answer for the current question
    const currentQ = room.questions[room.currentQuestionIndex];
    const correctAnswer = currentQ.correctAnswer;

    io.to(roomCode).emit('question_result', {
      correctAnswer,
      leaderboard,
      currentQuestionIndex: room.currentQuestionIndex,
      isLastQuestion: room.currentQuestionIndex === room.questions.length - 1
    });

    // Reset answers buffer
    room.answersReceived = {};

    // Schedule next step in 5 seconds
    setTimeout(() => {
      advanceBattle(roomCode);
    }, 5000);
  }

  // Helper: Advance to next question or end the game
  function advanceBattle(roomCode) {
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'playing') return;

    room.currentQuestionIndex += 1;

    if (room.currentQuestionIndex >= room.questions.length) {
      // End the quiz battle
      room.status = 'ended';
      const finalLeaderboard = [...room.players].sort((a, b) => b.score - a.score);
      io.to(roomCode).emit('battle_ended', { leaderboard: finalLeaderboard });
      rooms.delete(roomCode); // Clean up memory
      console.log(`Battle in room ${roomCode} ended and room deleted`);
    } else {
      // Broadcast next question
      io.to(roomCode).emit('next_question', {
        question: room.questions[room.currentQuestionIndex],
        currentIndex: room.currentQuestionIndex,
        totalQuestions: room.questions.length
      });
    }
  }
};
