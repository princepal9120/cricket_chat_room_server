const Message = require('../models/Message');


const getMessages = async (req, res) => {
  try {
    const messages = await Message.find()
      .populate('sender', 'name')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { getMessages };