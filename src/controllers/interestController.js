
const User = require('../models/User');

const updateInterest = async (req, res) => {
  try {
    const { interest } = req.body;

    if (!interest) {
      return res.status(400).json({ message: 'Please provide an interest' });
    }

    if (!['Playing Cricket', 'Watching Cricket'].includes(interest)) {
      return res.status(400).json({ message: 'Invalid interest selection' });
    }

    const user = await User.findById(req.user._id);

    if (user) {
      user.interest = interest;
      await user.save();

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        interest: user.interest,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { updateInterest };