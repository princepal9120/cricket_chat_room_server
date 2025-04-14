# Cricket Chat - Backend

This is the backend implementation of the Cricket Chat application, a WhatsApp clone with interest-based chat access. This Node.js/Express server provides authentication, real-time messaging, and role-based access control.

## Features

- User authentication with JWT
- Interest-based role management
- Real-time messaging with Socket.io
- Role-based message permissions
- User online status tracking
- Typing indicators
- Message persistence with MongoDB

## Tech Stack

- Node.js
- Express.js for API endpoints
- MongoDB with Mongoose ODM
- Socket.io for real-time communication
- JWT for authentication
- Bcrypt for password hashing

## Prerequisites

- Node.js (v14.0.0 or higher)
- npm (v6.0.0 or higher)
- MongoDB (local or Atlas)

## Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/cricket-chat.git
cd cricket-chat/backend
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Connection
MONGO_URI=mongodb://localhost:27017/cricket-chat
# or your MongoDB Atlas connection string

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Client URL (for CORS)
CLIENT_URL=http://localhost:3000
```

4. Start the development server
```bash
npm run dev
```

## Project Structure

```
src/
├── config/             # Configuration files
│   └── db.js           # Database connection
├── controllers/        # Request handlers
│   ├── authController.js
│   └── messageController.js
├── middleware/         # Express middleware
│   ├── auth.js         # Authentication middleware
│   └── errorHandler.js # Error handling middleware
├── models/             # MongoDB models
│   ├── Message.js
│   └── User.js
├── routes/             # API routes
│   ├── authRoutes.js
│   └── messageRoutes.js
├── socket/             # Socket.io implementation
│   └── index.js
├── utils/              # Utility functions
│   ├── jwt.js
│   └── validators.js
└── server.js           # Entry point
```

## API Endpoints

### Authentication

- **Register User**
  - `POST /api/auth/register`
  - Request Body: `{ name, email, password }`
  - Response: `{ token, user: { id, name, email } }`

- **Login User**
  - `POST /api/auth/login`
  - Request Body: `{ email, password }`
  - Response: `{ token, user: { id, name, email, interest } }`

- **Get Current User**
  - `GET /api/auth/me`
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ id, name, email, interest }`

- **Select Interest**
  - `PUT /api/auth/interest`
  - Headers: `Authorization: Bearer <token>`
  - Request Body: `{ interest }`
  - Response: `{ user: { id, name, email, interest } }`

### Messages

- **Get Messages**
  - `GET /api/messages`
  - Headers: `Authorization: Bearer <token>`
  - Response: `[{ id, text, sender, createdAt }, ...]`

- **Send Message**
  - `POST /api/messages`
  - Headers: `Authorization: Bearer <token>`
  - Request Body: `{ text }`
  - Response: `{ id, text, sender, createdAt }`

## Database Models

### User Model

```javascript
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  interest: {
    type: String,
    enum: ['Playing Cricket', 'Watching Cricket'],
    default: null
  },
  online: {
    type: Boolean,
    default: false
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });
```

### Message Model

```javascript
const MessageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });
```

## Socket Implementation

```javascript
// Excerpt from socket/index.js
const initSocket = (server) => {
  const io = require('socket.io')(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ['GET', 'POST']
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      
      // Get user from database
      const user = await User.findById(decoded.id);
      if (!user) {
        return next(new Error('User not found'));
      }
      
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.userId}`);
    
    // Update user online status
    await User.findByIdAndUpdate(socket.userId, { 
      online: true, 
      lastActive: new Date() 
    });
    
    // Broadcast user online status
    io.emit('userStatus', { userId: socket.userId, status: 'online' });
    
    // Handle new message
    socket.on('sendMessage', async (data) => {
      try {
        // Check if user has permission to send messages
        if (socket.user.interest !== 'Playing Cricket') {
          socket.emit('error', { message: 'You do not have permission to send messages' });
          return;
        }
        
        // Create new message
        const message = new Message({
          text: data.text,
          sender: socket.userId
        });
        
        await message.save();
        
        // Populate sender info
        await message.populate('sender', 'name email');
        
        // Broadcast message to all users
        io.emit('message', message);
      } catch (error) {
        socket.emit('error', { message: 'Error sending message' });
      }
    });
    
    // Handle typing indicators
    socket.on('typing', () => {
      socket.broadcast.emit('userTyping', socket.userId);
    });
    
    socket.on('stopTyping', () => {
      socket.broadcast.emit('userStoppedTyping', socket.userId);
    });
    
    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.userId}`);
      
      // Update user offline status
      await User.findByIdAndUpdate(socket.userId, { 
        online: false, 
        lastActive: new Date() 
      });
      
      // Broadcast user offline status
      io.emit('userStatus', { userId: socket.userId, status: 'offline' });
    });
  });

  return io;
};
```

## Role-Based Access Control Implementation

The role-based chat access is enforced in two places:

1. **Backend Socket Validation**:
```javascript
// Check if user has permission to send messages
if (socket.user.interest !== 'Playing Cricket') {
  socket.emit('error', { message: 'You do not have permission to send messages' });
  return;
}
```

2. **API Message Creation Endpoint**:
```javascript
// From messageController.js
exports.sendMessage = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Check if user has permission to send messages
    if (user.interest !== 'Playing Cricket') {
      return res.status(403).json({ message: 'You do not have permission to send messages' });
    }
    
    const message = new Message({
      text: req.body.text,
      sender: req.user.id
    });
    
    await message.save();
    await message.populate('sender', 'name email');
    
    // Emit message to all connected users
    req.app.get('io').emit('message', message);
    
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Error sending message' });
  }
};
```

## Error Handling

```javascript
// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    message
  });
};

module.exports = errorHandler;
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
