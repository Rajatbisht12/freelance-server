const express = require('express');
const { body, validationResult, query } = require('express-validator');
const CustomRequest = require('../models/CustomRequest');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/custom-requests
// @desc    Submit a new custom design request
// @access  Private
router.post('/', auth, [
  body('title').trim().isLength({ min: 5, max: 200 }),
  body('description').trim().isLength({ min: 10, max: 2000 }),
  body('category').isString(),
  body('projectType').isString(),
  body('budget.min').isFloat({ min: 0 }),
  body('budget.max').isFloat({ min: 0 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const data = req.body;
    data.client = req.user._id;
    const customRequest = new CustomRequest(data);
    await customRequest.save();
    res.status(201).json({ message: 'Custom request submitted', customRequest });
  } catch (error) {
    console.error('Submit custom request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/custom-requests
// @desc    Get all custom requests (admin) or own requests (user)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = req.user.role === 'admin' ? {} : { client: req.user._id };
    if (status) filter.status = status;
    if (category) filter.category = category;
    const requests = await CustomRequest.find(filter)
      .populate('client', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await CustomRequest.countDocuments(filter);
    res.json({
      requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get custom requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/custom-requests/:id
// @desc    Get a custom request by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const customRequest = await CustomRequest.findById(req.params.id)
      .populate('client', 'name email');
    if (!customRequest) {
      return res.status(404).json({ message: 'Custom request not found' });
    }
    if (req.user.role !== 'admin' && customRequest.client._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(customRequest);
  } catch (error) {
    console.error('Get custom request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/custom-requests/:id
// @desc    Update a custom request (owner or admin)
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const customRequest = await CustomRequest.findById(req.params.id);
    if (!customRequest) {
      return res.status(404).json({ message: 'Custom request not found' });
    }
    if (req.user.role !== 'admin' && customRequest.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    Object.assign(customRequest, req.body);
    await customRequest.save();
    res.json({ message: 'Custom request updated', customRequest });
  } catch (error) {
    console.error('Update custom request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/custom-requests/:id
// @desc    Delete a custom request (owner or admin)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const customRequest = await CustomRequest.findById(req.params.id);
    if (!customRequest) {
      return res.status(404).json({ message: 'Custom request not found' });
    }
    if (req.user.role !== 'admin' && customRequest.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    await CustomRequest.findByIdAndDelete(req.params.id);
    res.json({ message: 'Custom request deleted' });
  } catch (error) {
    console.error('Delete custom request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/custom-requests/:id/status
// @desc    Update status (admin only)
// @access  Private (Admin)
router.put('/:id/status', adminAuth, [
  body('status').isIn(['submitted', 'reviewing', 'quoted', 'accepted', 'in-progress', 'completed', 'cancelled'])
], async (req, res) => {
  try {
    const customRequest = await CustomRequest.findById(req.params.id);
    if (!customRequest) {
      return res.status(404).json({ message: 'Custom request not found' });
    }
    customRequest.status = req.body.status;
    await customRequest.save();
    res.json({ message: 'Status updated', customRequest });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 