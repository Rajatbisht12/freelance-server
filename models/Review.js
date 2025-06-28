const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  design: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Design'
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  type: {
    type: String,
    enum: ['design', 'service', 'overall'],
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  images: [{
    url: String,
    alt: String
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  helpful: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    helpful: {
      type: Boolean,
      required: true
    }
  }],
  helpfulCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminResponse: {
    comment: String,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    respondedAt: Date
  },
  tags: [String], // For categorizing reviews (e.g., 'quality', 'delivery', 'support')
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative'],
    default: 'positive'
  }
}, {
  timestamps: true
});

// Index for efficient querying
reviewSchema.index({ design: 1, type: 1, status: 1 });
reviewSchema.index({ user: 1, createdAt: -1 });

// Virtual for helpful percentage
reviewSchema.virtual('helpfulPercentage').get(function() {
  if (this.helpful.length === 0) return 0;
  const helpfulVotes = this.helpful.filter(h => h.helpful).length;
  return Math.round((helpfulVotes / this.helpful.length) * 100);
});

// Method to add helpful vote
reviewSchema.methods.addHelpfulVote = function(userId, isHelpful) {
  // Remove existing vote by this user
  this.helpful = this.helpful.filter(h => h.user.toString() !== userId.toString());
  
  // Add new vote
  this.helpful.push({ user: userId, helpful: isHelpful });
  
  // Update helpful count
  this.helpfulCount = this.helpful.filter(h => h.helpful).length;
  
  return this.save();
};

// Method to approve review
reviewSchema.methods.approve = function() {
  this.status = 'approved';
  return this.save();
};

// Method to reject review
reviewSchema.methods.reject = function() {
  this.status = 'rejected';
  return this.save();
};

// Method to add admin response
reviewSchema.methods.addAdminResponse = function(comment, adminId) {
  this.adminResponse = {
    comment,
    respondedBy: adminId,
    respondedAt: new Date()
  };
  return this.save();
};

// Static method to get average rating for a design
reviewSchema.statics.getAverageRating = function(designId) {
  return this.aggregate([
    { $match: { design: designId, status: 'approved' } },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
};

// Static method to get review statistics
reviewSchema.statics.getReviewStats = function(designId) {
  return this.aggregate([
    { $match: { design: designId, status: 'approved' } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Review', reviewSchema); 