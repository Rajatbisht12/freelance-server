const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  excerpt: {
    type: String,
    required: true,
    maxlength: 300
  },
  content: {
    type: String,
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['industry-news', 'design-trends', 'sustainability', 'technology', 'case-studies', 'tips-tricks', 'interviews', 'events']
  },
  tags: [String],
  featuredImage: {
    url: String,
    alt: String,
    caption: String
  },
  images: [{
    url: String,
    alt: String,
    caption: String
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: Date,
  readTime: {
    type: Number, // in minutes
    default: 5
  },
  viewCount: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  commentCount: {
    type: Number,
    default: 0
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
    ogImage: String
  },
  relatedPosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog'
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    createdAt: Date,
    isApproved: {
      type: Boolean,
      default: false
    }
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Index for search and filtering
blogSchema.index({ title: 'text', content: 'text', tags: 'text' });
blogSchema.index({ slug: 1 });
blogSchema.index({ category: 1, status: 1, publishedAt: -1 });

// Generate slug from title before saving
blogSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  
  // Set publishedAt when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
    this.isPublished = true;
  }
  
  next();
});

// Virtual for formatted published date
blogSchema.virtual('formattedPublishedDate').get(function() {
  if (!this.publishedAt) return null;
  return this.publishedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Method to increment view count
blogSchema.methods.incrementView = function() {
  this.viewCount += 1;
  return this.save();
};

// Method to add like
blogSchema.methods.addLike = function(userId) {
  if (!this.likes.includes(userId)) {
    this.likes.push(userId);
    this.likeCount = this.likes.length;
  }
  return this.save();
};

// Method to remove like
blogSchema.methods.removeLike = function(userId) {
  this.likes = this.likes.filter(id => id.toString() !== userId.toString());
  this.likeCount = this.likes.length;
  return this.save();
};

// Method to add comment
blogSchema.methods.addComment = function(userId, content) {
  this.comments.push({
    user: userId,
    content,
    createdAt: new Date()
  });
  this.commentCount = this.comments.length;
  return this.save();
};

// Method to approve comment
blogSchema.methods.approveComment = function(commentId) {
  const comment = this.comments.id(commentId);
  if (comment) {
    comment.isApproved = true;
  }
  return this.save();
};

// Static method to get popular posts
blogSchema.statics.getPopularPosts = function(limit = 5) {
  return this.find({ status: 'published' })
    .sort({ viewCount: -1, publishedAt: -1 })
    .limit(limit)
    .populate('author', 'name avatar');
};

// Static method to get related posts
blogSchema.statics.getRelatedPosts = function(postId, category, tags, limit = 3) {
  return this.find({
    _id: { $ne: postId },
    status: 'published',
    $or: [
      { category },
      { tags: { $in: tags } }
    ]
  })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate('author', 'name avatar');
};

// Static method to get posts by category
blogSchema.statics.getPostsByCategory = function(category, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ category, status: 'published' })
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('author', 'name avatar');
};

module.exports = mongoose.model('Blog', blogSchema); 