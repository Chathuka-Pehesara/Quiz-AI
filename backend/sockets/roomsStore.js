// Store rooms in memory: roomCode -> roomData
// Expose as a shared singleton so both Socket.io and REST routes can access active rooms count
const rooms = new Map();

module.exports = rooms;
