const mongoose = require('mongoose');

const designSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['residential', 'commercial', 'landscape', 'interior', 'urban-planning', 'sustainable', 'modern', 'classical', 'minimalist', 'luxury']
  },
  style: {
    type: String,
    required: true,
    enum: ['modern', 'classical', 'contemporary', 'traditional', 'minimalist', 'luxury', 'eco-friendly', 'industrial', 'mediterranean', 'scandinavian']
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  images: [{
    url: String,
    alt: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  model3d: {
    file: {
      type: String, // Path to 3D model file
      required: false
    },
    format: {
      type: String,
      enum: ['gltf', 'glb', 'obj', 'fbx', 'dae'],
      default: 'glb'
    },
    size: Number, // File size in bytes
    previewUrl: String, // Screenshot or preview image
    cloudinaryUrl: String, // Cloudinary 3D viewer URL
    cloudinaryAssetId: String, // Cloudinary asset ID for 3D viewer
    cloudinaryCloudName: String // Cloudinary cloud name
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
    materials: [String],
    colors: [String],
    features: [String]
  },
  tags: [String],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  license: {
    type: String,
    enum: ['personal', 'commercial', 'exclusive'],
    default: 'personal'
  },
  usageRights: {
    type: String,
    default: 'Single use license'
  },
  relatedDesigns: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Design'
  }]
}, {
  timestamps: true
});

// Index for search functionality
designSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Virtual for formatted price
designSchema.virtual('formattedPrice').get(function() {
  return `${this.currency} ${this.price.toFixed(2)}`;
});

// Method to increment view count
designSchema.methods.incrementView = function() {
  this.viewCount += 1;
  return this.save();
};

// Method to increment download count
designSchema.methods.incrementDownload = function() {
  this.downloadCount += 1;
  return this.save();
};

// Method to update rating
designSchema.methods.updateRating = function(newRating) {
  const totalRating = this.rating.average * this.rating.count + newRating;
  this.rating.count += 1;
  this.rating.average = totalRating / this.rating.count;
  return this.save();
};

module.exports = mongoose.model('Design', designSchema); 