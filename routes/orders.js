const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Design = require('../models/Design');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/orders
// @desc    Create a new order
// @access  Private
router.post('/', auth, [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.design').isMongoId().withMessage('Invalid design ID'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.license').isIn(['personal', 'commercial', 'exclusive']).withMessage('Invalid license type'),
  body('paymentMethod').isIn(['stripe', 'paypal', 'bank-transfer', 'crypto']).withMessage('Invalid payment method'),
  body('billingAddress').isObject().withMessage('Billing address is required'),
  body('billingAddress.name').notEmpty().withMessage('Billing name is required'),
  body('billingAddress.email').isEmail().withMessage('Valid billing email is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { items, paymentMethod, billingAddress, shippingAddress, notes } = req.body;

    // Validate and get design details
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const design = await Design.findById(item.design);
      if (!design) {
        return res.status(400).json({ message: `Design with ID ${item.design} not found` });
      }

      if (design.status !== 'published') {
        return res.status(400).json({ message: `Design ${design.title} is not available for purchase` });
      }

      const itemTotal = design.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        design: design._id,
        quantity: item.quantity,
        price: design.price,
        license: item.license
      });
    }

    // Calculate tax (example: 8.5% tax rate)
    const taxRate = 0.085;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    // Create order
    const order = new Order({
      customer: req.user._id,
      items: orderItems,
      subtotal,
      tax,
      total,
      paymentMethod,
      billingAddress,
      shippingAddress: shippingAddress || billingAddress,
      notes
    });

    await order.save();

    // Populate design details for response
    const populatedOrder = await Order.findById(order._id)
      .populate('customer', 'name email')
      .populate('items.design', 'title images price');

    res.status(201).json({
      message: 'Order created successfully',
      order: populatedOrder
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/orders
// @desc    Get user's orders
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { customer: req.user._id };
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate('items.design', 'title images price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone address')
      .populate('items.design', 'title images price model3d');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user owns the order or is admin
    if (order.customer._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order status
// @access  Private (Admin only)
router.put('/:id/status', adminAuth, [
  body('status').isIn(['pending', 'processing', 'completed', 'cancelled', 'refunded']).withMessage('Invalid status'),
  body('paymentStatus').optional().isIn(['pending', 'paid', 'failed', 'refunded']).withMessage('Invalid payment status')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, paymentStatus } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    if (paymentStatus) {
      order.paymentStatus = paymentStatus;
    }

    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate('customer', 'name email')
      .populate('items.design', 'title images price');

    res.json({
      message: 'Order status updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update order status error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/orders/:id/tracking
// @desc    Add tracking update
// @access  Private (Admin only)
router.post('/:id/tracking', adminAuth, [
  body('status').notEmpty().withMessage('Tracking status is required'),
  body('location').optional().trim(),
  body('description').optional().trim()
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, location, description } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await order.addTrackingUpdate(status, location, description);

    res.json({ message: 'Tracking update added successfully' });
  } catch (error) {
    console.error('Add tracking update error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/orders/:id/refund
// @desc    Process refund
// @access  Private (Admin only)
router.post('/:id/refund', adminAuth, [
  body('amount').isFloat({ min: 0 }).withMessage('Refund amount must be a positive number'),
  body('reason').notEmpty().withMessage('Refund reason is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, reason } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (amount > order.total) {
      return res.status(400).json({ message: 'Refund amount cannot exceed order total' });
    }

    await order.processRefund(amount, reason, req.user._id);

    res.json({ message: 'Refund processed successfully' });
  } catch (error) {
    console.error('Process refund error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/orders/admin/all
// @desc    Get all orders (Admin only)
// @access  Private (Admin only)
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, paymentStatus } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const orders = await Order.find(filter)
      .populate('customer', 'name email')
      .populate('items.design', 'title images price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/orders/stats/summary
// @desc    Get order statistics summary
// @access  Private (Admin only)
router.get('/stats/summary', adminAuth, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const stats = await Order.aggregate([
      {
        $facet: {
          totalOrders: [{ $count: 'count' }],
          totalRevenue: [{ $group: { _id: null, total: { $sum: '$total' } } }],
          todayOrders: [
            { $match: { createdAt: { $gte: startOfDay } } },
            { $count: 'count' }
          ],
          todayRevenue: [
            { $match: { createdAt: { $gte: startOfDay } } },
            { $group: { _id: null, total: { $sum: '$total' } } }
          ],
          monthOrders: [
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $count: 'count' }
          ],
          monthRevenue: [
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$total' } } }
          ],
          statusDistribution: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ]
        }
      }
    ]);

    const summary = {
      totalOrders: stats[0].totalOrders[0]?.count || 0,
      totalRevenue: stats[0].totalRevenue[0]?.total || 0,
      todayOrders: stats[0].todayOrders[0]?.count || 0,
      todayRevenue: stats[0].todayRevenue[0]?.total || 0,
      monthOrders: stats[0].monthOrders[0]?.count || 0,
      monthRevenue: stats[0].monthRevenue[0]?.total || 0,
      statusDistribution: stats[0].statusDistribution
    };

    res.json(summary);
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 