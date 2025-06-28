const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Design = require('../models/Design');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/designs
// @desc    Get all designs with filtering and pagination
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('category').optional().isIn(['residential', 'commercial', 'landscape', 'interior', 'urban-planning', 'sustainable', 'modern', 'classical', 'minimalist', 'luxury']),
  query('style').optional().isIn(['modern', 'classical', 'contemporary', 'traditional', 'minimalist', 'luxury', 'eco-friendly', 'industrial', 'mediterranean', 'scandinavian']),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('Min price must be a positive number'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Max price must be a positive number'),
  query('search').optional().trim(),
  query('sortBy').optional().isIn(['price', 'createdAt', 'viewCount', 'downloadCount', 'rating']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      page = 1,
      limit = 12,
      category,
      style,
      minPrice,
      maxPrice,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { status: 'published' };
    
    if (category) filter.category = category;
    if (style) filter.style = style;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    if (search) {
      filter.$text = { $search: search };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const designs = await Design.find(filter)
      .populate('author', 'name avatar')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Design.countDocuments(filter);

    res.json({
      designs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get designs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/designs/featured
// @desc    Get featured designs
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    const designs = await Design.find({ 
      status: 'published', 
      isFeatured: true 
    })
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(6);

    res.json(designs);
  } catch (error) {
    console.error('Get featured designs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/designs/:id
// @desc    Get design by ID
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const design = await Design.findById(req.params.id)
      .populate('author', 'name avatar')
      .populate('relatedDesigns', 'title images price category');

    if (!design) {
      return res.status(404).json({ message: 'Design not found' });
    }

    // Increment view count if user is authenticated
    if (req.user) {
      await design.incrementView();
    }

    res.json(design);
  } catch (error) {
    console.error('Get design error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Design not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/designs
// @desc    Create a new design
// @access  Private (Admin only)
router.post('/', adminAuth, [
  body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('category').isIn(['residential', 'commercial', 'landscape', 'interior', 'urban-planning', 'sustainable', 'modern', 'classical', 'minimalist', 'luxury']).withMessage('Invalid category'),
  body('style').isIn(['modern', 'classical', 'contemporary', 'traditional', 'minimalist', 'luxury', 'eco-friendly', 'industrial', 'mediterranean', 'scandinavian']).withMessage('Invalid style'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('model3d.file').notEmpty().withMessage('3D model file is required'),
  body('model3d.format').isIn(['gltf', 'glb', 'obj', 'fbx', 'dae']).withMessage('Invalid 3D model format')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const designData = {
      ...req.body,
      author: req.user._id
    };

    const design = new Design(designData);
    await design.save();

    const populatedDesign = await Design.findById(design._id)
      .populate('author', 'name avatar');

    res.status(201).json({
      message: 'Design created successfully',
      design: populatedDesign
    });
  } catch (error) {
    console.error('Create design error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/designs/:id
// @desc    Update a design
// @access  Private (Admin only)
router.put('/:id', adminAuth, [
  body('title').optional().trim().isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters'),
  body('description').optional().trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('category').optional().isIn(['residential', 'commercial', 'landscape', 'interior', 'urban-planning', 'sustainable', 'modern', 'classical', 'minimalist', 'luxury']).withMessage('Invalid category'),
  body('style').optional().isIn(['modern', 'classical', 'contemporary', 'traditional', 'minimalist', 'luxury', 'eco-friendly', 'industrial', 'mediterranean', 'scandinavian']).withMessage('Invalid style'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const design = await Design.findById(req.params.id);
    if (!design) {
      return res.status(404).json({ message: 'Design not found' });
    }

    // Update design
    Object.assign(design, req.body);
    await design.save();

    const updatedDesign = await Design.findById(design._id)
      .populate('author', 'name avatar');

    res.json({
      message: 'Design updated successfully',
      design: updatedDesign
    });
  } catch (error) {
    console.error('Update design error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Design not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/designs/:id
// @desc    Delete a design
// @access  Private (Admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const design = await Design.findById(req.params.id);
    if (!design) {
      return res.status(404).json({ message: 'Design not found' });
    }

    await Design.findByIdAndDelete(req.params.id);

    res.json({ message: 'Design deleted successfully' });
  } catch (error) {
    console.error('Delete design error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Design not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/designs/:id/favorite
// @desc    Add design to favorites
// @access  Private
router.post('/:id/favorite', auth, async (req, res) => {
  try {
    const design = await Design.findById(req.params.id);
    if (!design) {
      return res.status(404).json({ message: 'Design not found' });
    }

    const user = req.user;
    if (user.favorites.includes(design._id)) {
      return res.status(400).json({ message: 'Design already in favorites' });
    }

    user.favorites.push(design._id);
    await user.save();

    res.json({ message: 'Design added to favorites' });
  } catch (error) {
    console.error('Add to favorites error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/designs/:id/favorite
// @desc    Remove design from favorites
// @access  Private
router.delete('/:id/favorite', auth, async (req, res) => {
  try {
    const design = await Design.findById(req.params.id);
    if (!design) {
      return res.status(404).json({ message: 'Design not found' });
    }

    const user = req.user;
    user.favorites = user.favorites.filter(id => id.toString() !== design._id.toString());
    await user.save();

    res.json({ message: 'Design removed from favorites' });
  } catch (error) {
    console.error('Remove from favorites error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/designs/categories
// @desc    Get all design categories
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = await Design.distinct('category');
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/designs/styles
// @desc    Get all design styles
// @access  Public
router.get('/styles', async (req, res) => {
  try {
    const styles = await Design.distinct('style');
    res.json(styles);
  } catch (error) {
    console.error('Get styles error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 