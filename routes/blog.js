const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Blog = require('../models/Blog');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/blog
// @desc    Get all blog posts (with filtering and pagination)
// @access  Public
router.get('/', [
  query('category').optional().isString(),
  query('search').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const { category, search, page = 1, limit = 10 } = req.query;
    const filter = { status: 'published' };
    if (category) filter.category = category;
    if (search) filter.$text = { $search: search };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const posts = await Blog.find(filter)
      .populate('author', 'name avatar')
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await Blog.countDocuments(filter);
    res.json({
      posts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get blog posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/blog/:id
// @desc    Get blog post by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const post = await Blog.findById(req.params.id)
      .populate('author', 'name avatar');
    if (!post) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    await post.incrementView();
    res.json(post);
  } catch (error) {
    console.error('Get blog post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/blog
// @desc    Create a new blog post
// @access  Private (Admin)
router.post('/', adminAuth, [
  body('title').trim().isLength({ min: 5, max: 200 }),
  body('excerpt').trim().isLength({ min: 10, max: 300 }),
  body('content').trim().isLength({ min: 20 }),
  body('category').isString(),
  body('tags').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { title, excerpt, content, category, tags, featuredImage, images, seo } = req.body;
    const post = new Blog({
      title,
      excerpt,
      content,
      category,
      tags,
      featuredImage,
      images,
      seo,
      author: req.user._id,
      status: 'published',
      publishedAt: new Date(),
      isPublished: true
    });
    await post.save();
    res.status(201).json({ message: 'Blog post created', post });
  } catch (error) {
    console.error('Create blog post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/blog/:id
// @desc    Update a blog post
// @access  Private (Admin)
router.put('/:id', adminAuth, [
  body('title').optional().trim().isLength({ min: 5, max: 200 }),
  body('excerpt').optional().trim().isLength({ min: 10, max: 300 }),
  body('content').optional().trim().isLength({ min: 20 }),
  body('category').optional().isString(),
  body('tags').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const post = await Blog.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    Object.assign(post, req.body);
    await post.save();
    res.json({ message: 'Blog post updated', post });
  } catch (error) {
    console.error('Update blog post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/blog/:id
// @desc    Delete a blog post
// @access  Private (Admin)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const post = await Blog.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    await Blog.findByIdAndDelete(req.params.id);
    res.json({ message: 'Blog post deleted' });
  } catch (error) {
    console.error('Delete blog post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/blog/:id/comment
// @desc    Add a comment to a blog post
// @access  Private
router.post('/:id/comment', auth, [
  body('content').trim().isLength({ min: 2, max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const post = await Blog.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    post.comments.push({
      user: req.user._id,
      content: req.body.content,
      createdAt: new Date(),
      isApproved: false
    });
    post.commentCount = post.comments.length;
    await post.save();
    res.json({ message: 'Comment submitted for approval' });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/blog/:id/comment/:commentId/approve
// @desc    Approve a comment (admin only)
// @access  Private (Admin)
router.put('/:id/comment/:commentId/approve', adminAuth, async (req, res) => {
  try {
    const post = await Blog.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    comment.isApproved = true;
    await post.save();
    res.json({ message: 'Comment approved' });
  } catch (error) {
    console.error('Approve comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/blog/:id/comment/:commentId
// @desc    Delete a comment (admin or owner)
// @access  Private
router.delete('/:id/comment/:commentId', auth, async (req, res) => {
  try {
    const post = await Blog.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    if (comment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    comment.remove();
    post.commentCount = post.comments.length;
    await post.save();
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 