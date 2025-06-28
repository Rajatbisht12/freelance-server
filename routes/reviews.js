const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Review = require('../models/Review');
const Design = require('../models/Design');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/reviews
// @desc    Get all reviews (with filtering and pagination)
// @access  Public
router.get('/', [
  query('design').optional().isMongoId(),
  query('user').optional().isMongoId(),
  query('type').optional().isIn(['design', 'service', 'overall']),
  query('status').optional().isIn(['pending', 'approved', 'rejected']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const { design, user, type, status, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (design) filter.design = design;
    if (user) filter.user = user;
    if (type) filter.type = type;
    if (status) filter.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const reviews = await Review.find(filter)
      .populate('user', 'name avatar')
      .populate('design', 'title images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await Review.countDocuments(filter);
    res.json({
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reviews/:id
// @desc    Get review by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('user', 'name avatar')
      .populate('design', 'title images');
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    res.json(review);
  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/reviews
// @desc    Add a new review
// @access  Private
router.post('/', auth, [
  body('type').isIn(['design', 'service', 'overall']).withMessage('Invalid review type'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('title').trim().isLength({ min: 3, max: 100 }),
  body('comment').trim().isLength({ min: 5, max: 1000 }),
  body('design').optional().isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { type, rating, title, comment, design } = req.body;
    if (type === 'design' && !design) {
      return res.status(400).json({ message: 'Design ID is required for design reviews' });
    }
    // Prevent duplicate reviews by the same user for the same design/type
    const existing = await Review.findOne({ user: req.user._id, design, type });
    if (existing) {
      return res.status(400).json({ message: 'You have already reviewed this item' });
    }
    const review = new Review({
      user: req.user._id,
      type,
      rating,
      title,
      comment,
      design: design || undefined,
      status: 'pending'
    });
    await review.save();
    res.status(201).json({ message: 'Review submitted for approval', review });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/reviews/:id
// @desc    Update a review (owner or admin)
// @access  Private
router.put('/:id', auth, [
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('title').optional().trim().isLength({ min: 3, max: 100 }),
  body('comment').optional().trim().isLength({ min: 5, max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    Object.assign(review, req.body);
    review.status = 'pending'; // Re-approve after edit
    await review.save();
    res.json({ message: 'Review updated and submitted for approval', review });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/reviews/:id
// @desc    Delete a review (owner or admin)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    await Review.findByIdAndDelete(req.params.id);
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/reviews/:id/approve
// @desc    Approve a review (admin only)
// @access  Private (Admin)
router.put('/:id/approve', adminAuth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    review.status = 'approved';
    await review.save();
    res.json({ message: 'Review approved' });
  } catch (error) {
    console.error('Approve review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/reviews/:id/reject
// @desc    Reject a review (admin only)
// @access  Private (Admin)
router.put('/:id/reject', adminAuth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    review.status = 'rejected';
    await review.save();
    res.json({ message: 'Review rejected' });
  } catch (error) {
    console.error('Reject review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 