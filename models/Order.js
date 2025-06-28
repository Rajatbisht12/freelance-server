const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    design: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Design',
      required: true
    },
    quantity: {
      type: Number,
      default: 1
    },
    price: {
      type: Number,
      required: true
    },
    license: {
      type: String,
      enum: ['personal', 'commercial', 'exclusive'],
      default: 'personal'
    }
  }],
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'paypal', 'bank-transfer', 'crypto'],
    required: true
  },
  paymentDetails: {
    transactionId: String,
    paymentDate: Date,
    gateway: String
  },
  billingAddress: {
    name: String,
    email: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  shippingAddress: {
    name: String,
    email: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  notes: String,
  tracking: {
    number: String,
    carrier: String,
    status: String,
    updates: [{
      status: String,
      location: String,
      timestamp: Date,
      description: String
    }]
  },
  downloads: [{
    design: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Design'
    },
    downloadUrl: String,
    expiresAt: Date,
    downloadCount: {
      type: Number,
      default: 0
    }
  }],
  refund: {
    amount: Number,
    reason: String,
    processedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true
});

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Get count of orders for today
    const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    
    const orderCount = await this.constructor.countDocuments({
      createdAt: { $gte: todayStart, $lt: todayEnd }
    });
    
    const sequence = (orderCount + 1).toString().padStart(3, '0');
    this.orderNumber = `ORD${year}${month}${day}${sequence}`;
  }
  next();
});

// Virtual for formatted total
orderSchema.virtual('formattedTotal').get(function() {
  return `${this.currency} ${this.total.toFixed(2)}`;
});

// Method to calculate totals
orderSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  this.total = this.subtotal + this.tax;
  return this;
};

// Method to add tracking update
orderSchema.methods.addTrackingUpdate = function(status, location, description) {
  this.tracking.updates.push({
    status,
    location,
    timestamp: new Date(),
    description
  });
  this.tracking.status = status;
  return this.save();
};

// Method to process refund
orderSchema.methods.processRefund = function(amount, reason, processedBy) {
  this.refund = {
    amount,
    reason,
    processedAt: new Date(),
    processedBy
  };
  this.status = 'refunded';
  this.paymentStatus = 'refunded';
  return this.save();
};

module.exports = mongoose.model('Order', orderSchema); 