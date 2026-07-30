const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  // Who receives this notification
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  
  // Who sent this notification
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  senderName: { type: String, default: '' },
  
  // Notification content
  type: { 
    type: String, 
    enum: [
      'callback_reminder', 
      'callback_today', 
      'callback_overdue', 
      'system',
      // New enterprise notification types
      'share_request',      // When someone shares candidates with you
      'invitation',         // When someone invites you to their team
      'share_accepted',     // When someone accepts your share request
      'share_declined',    // When someone declines your share request
      'invitation_accepted', // When someone accepts your invitation
      'invitation_declined' // When someone declines your invitation
    ],
    required: true 
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  
  // Related candidate info
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
  candidateName: { type: String },
  candidatePosition: { type: String },
  candidateContact: { type: String },
  callBackDate: { type: String },
  
  // Related member info (for invitations/shares)
  relatedMemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember', default: null },
  relatedEmail: { type: String, default: '' },
  
  // Priority: urgent (today/overdue), high (1-2 days), medium (3-5 days), low (6-7 days)
  priority: { 
    type: String, 
    enum: ['urgent', 'high', 'medium', 'low'],
    default: 'medium' 
  },
  
  // Days remaining until callback
  daysRemaining: { type: Number },
  
  // Action required - for share requests and invitations
  actionRequired: { type: Boolean, default: false },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'declined', 'expired'],
    default: 'pending' 
  },
  
  // Status tracking
  isRead: { type: Boolean, default: false },
  isDismissed: { type: Boolean, default: false },
  
  // Email reminder tracking
  emailSent: { type: Boolean, default: false },
  emailSentAt: { type: Date },
  
  // Dedup key: prevents duplicate notifications for the same candidate+date+day
  dedupKey: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date } // Auto-cleanup after callback date passes + buffer
});

// TTL index: auto-delete notifications 30 days after expiry
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for efficient queries
NotificationSchema.index({ userId: 1, isRead: 1, isDismissed: 1, createdAt: -1 });
NotificationSchema.index({ dedupKey: 1 }, { unique: true, sparse: true });
// Index for action-required notifications
NotificationSchema.index({ userId: 1, actionRequired: 1, status: 1 });
// Index for notification type queries
NotificationSchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
