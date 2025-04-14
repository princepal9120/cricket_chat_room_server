const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');

let typingUsers = new Map();

const setupSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      if (!socket.handshake.auth || !socket.handshake.auth.token) {
        return next(new Error('Authentication error'));
      }

      const token = socket.handshake.auth.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name}`);

    socket.join('chat');

    socket.emit('user_info', {
      _id: socket.user._id,
      name: socket.user.name,
      interest: socket.user.interest
    });

    socket.on('send_message', async (messageData) => {
      if (socket.user.interest !== 'Playing Cricket') {
        socket.emit('error', { message: 'You are not allowed to send messages' });
        return;
      }

      try {
        const message = await Message.create({
          sender: socket.user._id,
          text: messageData.text,
        });

        const populatedMessage = await Message.findById(message._id).populate('sender', 'name');

        io.to('chat').emit('new_message', {
          _id: populatedMessage._id,
          text: populatedMessage.text,
          sender: {
            _id: populatedMessage.sender._id,
            name: populatedMessage.sender.name,
          },
          createdAt: populatedMessage.createdAt,
        });

        if (typingUsers.has(socket.user._id.toString())) {
          typingUsers.delete(socket.user._id.toString());
          io.to('chat').emit('typing_users', Array.from(typingUsers.values()));
        }
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Error sending message' });
      }
    });

    socket.on('typing', (isTyping) => {
      if (socket.user.interest !== 'Playing Cricket') {
        return;
      }

      const userId = socket.user._id.toString();

      if (isTyping) {
        typingUsers.set(userId, socket.user.name);
      } else {
        typingUsers.delete(userId);
      }

      socket.broadcast.to('chat').emit('typing_users', Array.from(typingUsers.values()));
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.name}`);

      const userId = socket.user._id.toString();
      if (typingUsers.has(userId)) {
        typingUsers.delete(userId);
        io.to('chat').emit('typing_users', Array.from(typingUsers.values()));
      }
    });
  });
};

module.exports = setupSocket;
