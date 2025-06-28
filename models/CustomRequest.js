const mongoose = require('mongoose');

const customRequestSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    enum: ['residential', 'commercial', 'landscape', 'interior', 'urban-planning', 'sustainable', 'renovation', 'new-construction']
  },
  projectType: {
    type: String,
    required: true,
    enum: ['concept-design', 'detailed-design', 'construction-documents', '3d-visualization', 'master-planning', 'interior-design']
  },
  budget: {
    min: {
      type: Number,
      required: true
    },
    max: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  timeline: {
    startDate: Date,
    endDate: Date,
    urgency: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    }
  },
  specifications: {
    dimensions: {
      width: Number,
      height: Number,
      depth: Number,
      unit: {
        type: String,
        default: 'meters'
      }
    },
    style: {
      type: String,
      enum: ['modern', 'classical', 'contemporary', 'traditional', 'minimalist', 'luxury', 'eco-friendly', 'industrial', 'mediterranean', 'scandinavian']
    },
    materials: [String],
    colors: [String],
    features: [String],
    requirements: [String]
  },
  attachments: [{
    filename: String,
    originalName: String,
    url: String,
    size: Number,
    type: String
  }],
  references: [{
    title: String,
    url: String,
    description: String
  }],
  status: {
    type: String,
    enum: ['submitted', 'reviewing', 'quoted', 'accepted', 'in-progress', 'completed', 'cancelled'],
    default: 'submitted'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  quote: {
    amount: Number,
    currency: String,
    breakdown: [{
      item: String,
      description: String,
      cost: Number
    }],
    validUntil: Date,
    terms: String
  },
  milestones: [{
    title: String,
    description: String,
    dueDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'delayed'],
      default: 'pending'
    },
    deliverables: [String],
    completedAt: Date
  }],
  communications: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    attachments: [{
      filename: String,
      url: String,
      type: String
    }],
    timestamp: {
      type: Date,
      default: Date.now
    },
    isInternal: {
      type: Boolean,
      default: false
    }
  }],
  deliverables: [{
    title: String,
    description: String,
    files: [{
      filename: String,
      url: String,
      type: String,
      size: Number
    }],
    deliveredAt: Date,
    status: {
      type: String,
      enum: ['pending', 'delivered', 'approved', 'revision-requested'],
      default: 'pending'
    }
  }],
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    submittedAt: Date
  },
  tags: [String],
  notes: String
}, {
  timestamps: true
});

// Index for efficient querying
customRequestSchema.index({ client: 1, status: 1, createdAt: -1 });
customRequestSchema.index({ assignedTo: 1, status: 1 });
customRequestSchema.index({ category: 1, projectType: 1 });

// Virtual for formatted budget range
customRequestSchema.virtual('formattedBudget').get(function() {
  return `${this.budget.currency} ${this.budget.min.toLocaleString()} - ${this.budget.max.toLocaleString()}`;
});

// Virtual for project duration
customRequestSchema.virtual('duration').get(function() {
  if (!this.timeline.startDate || !this.timeline.endDate) return null;
  const diffTime = Math.abs(this.timeline.endDate - this.timeline.startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Method to add communication
customRequestSchema.methods.addCommunication = function(senderId, message, attachments = [], isInternal = false) {
  this.communications.push({
    sender: senderId,
    message,
    attachments,
    isInternal
  });
  return this.save();
};

// Method to add milestone
customRequestSchema.methods.addMilestone = function(title, description, dueDate, deliverables = []) {
  this.milestones.push({
    title,
    description,
    dueDate,
    deliverables
  });
  return this.save();
};

// Method to update milestone status
customRequestSchema.methods.updateMilestoneStatus = function(milestoneId, status) {
  const milestone = this.milestones.id(milestoneId);
  if (milestone) {
    milestone.status = status;
    if (status === 'completed') {
      milestone.completedAt = new Date();
    }
  }
  return this.save();
};

// Method to add deliverable
customRequestSchema.methods.addDeliverable = function(title, description, files = []) {
  this.deliverables.push({
    title,
    description,
    files
  });
  return this.save();
};

// Method to update deliverable status
customRequestSchema.methods.updateDeliverableStatus = function(deliverableId, status) {
  const deliverable = this.deliverables.id(deliverableId);
  if (deliverable) {
    deliverable.status = status;
    if (status === 'delivered') {
      deliverable.deliveredAt = new Date();
    }
  }
  return this.save();
};

// Method to submit feedback
customRequestSchema.methods.submitFeedback = function(rating, comment) {
  this.feedback = {
    rating,
    comment,
    submittedAt: new Date()
  };
  return this.save();
};

// Static method to get requests by status
customRequestSchema.statics.getByStatus = function(status, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ status })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('client', 'name email')
    .populate('assignedTo', 'name email');
};

// Static method to get requests by assigned user
customRequestSchema.statics.getByAssignedUser = function(userId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ assignedTo: userId })
    .sort({ priority: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('client', 'name email');
};

module.exports = mongoose.model('CustomRequest', customRequestSchema); 