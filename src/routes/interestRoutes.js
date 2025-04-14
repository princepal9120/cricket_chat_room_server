const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { validate } = require('../middleware/validationMiddleware');
const { updateInterest } = require('../controllers/interestController');
const { protect } = require('../middleware/authMiddleware');


router.put(
  '/interest',
  [
    check('interest', 'Interest is required').not().isEmpty(),
    check('interest', 'Invalid interest selection').isIn([
      'Playing Cricket',
      'Watching Cricket',
    ]),
    validate,
  ],
  protect,
  updateInterest
);

module.exports = router;