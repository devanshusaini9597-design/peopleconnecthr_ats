// backend/controllers/analyticsController.js
const Candidate = require('../models/Candidate');

exports.getAnalytics = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const userFilter = { createdBy: userId };

    // 1. Daily CV Submission Tracking (Last 7 days)
    const dailySubmissions = await Candidate.aggregate([
      { $match: userFilter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 7 },
      { $sort: { _id: 1 } }
    ]);

    // 2. Source-wise Performance
    const sourcePerformance = await Candidate.aggregate([
      { $match: userFilter },
      {
        $group: {
          _id: "$source", 
          count: { $sum: 1 }
        }
      }
    ]);

    // 3. Offer vs Joining Ratio
    const statusCounts = await Candidate.aggregate([
      {
        $match: { ...userFilter, status: { $in: ["Offer", "Joined"] } } 
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // 4. Time-to-Hire (Average days)
    const timeToHire = await Candidate.aggregate([
      { $match: { ...userFilter, status: "Joined", hiredDate: { $exists: true } } },
      {
        $project: {
          days: {
            $divide: [
              { $subtract: ["$hiredDate", "$createdAt"] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDays: { $avg: "$days" }
        }
      }
    ]);

    res.status(200).json({
      dailySubmissions,
      sourcePerformance,
      statusCounts,
      avgTimeToHire: timeToHire[0]?.avgDays || 0
    });

  } catch (err) {
    console.log("Database Error:", err);
    res.status(500).json({ message: "Error fetching analytics", error: err.message });
  }    
};

// Dashboard Stats endpoint - returns all data needed for dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const userFilter = { createdBy: userId };

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Total candidates (this user only)
    const totalCandidates = await Candidate.countDocuments(userFilter);

    // This month additions
    const thisMonthCount = await Candidate.countDocuments({ ...userFilter, createdAt: { $gte: startOfMonth } });
    
    // Last month for trend calc
    const lastMonthCount = await Candidate.countDocuments({ ...userFilter, createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } });

    // Status-wise pipeline counts
    const pipelineCounts = await Candidate.aggregate([
      { $match: userFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const pipeline = {};
    pipelineCounts.forEach(p => { pipeline[p._id] = p.count; });

    // Pending review (Applied + Screening)
    const pendingReview = (pipeline['Applied'] || 0) + (pipeline['Screening'] || 0);

    // Top positions
    const topPositions = await Candidate.aggregate([
      { $match: { ...userFilter, position: { $exists: true, $ne: '' } } },
      { $group: { _id: '$position', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Top sources
    const topSources = await Candidate.aggregate([
      { $match: { ...userFilter, source: { $exists: true, $ne: '' } } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Recent candidates (last 5 for this user)
    const recentCandidates = await Candidate.find(userFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name position status createdAt source');

    // Monthly trend (percentage)
    const candidateTrend = lastMonthCount > 0 ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100) : (thisMonthCount > 0 ? 100 : 0);

    // Daily submissions (last 7 days)
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const dailySubmissions = await Candidate.aggregate([
      { $match: { ...userFilter, createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    // Fill in missing days
    const dailyData = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      const found = dailySubmissions.find(ds => ds._id === key);
      dailyData.push({ date: key, day: d.toLocaleDateString('en-US', { weekday: 'short' }), count: found ? found.count : 0 });
    }

    // Location breakdown
    const locationBreakdown = await Candidate.aggregate([
      { $match: { ...userFilter, location: { $exists: true, $ne: '' } } },
      { $group: { _id: '$location', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 }
    ]);

    // Offer-to-Join ratio
    const offerCount = pipeline['Offer'] || 0;
    const joinedCount = pipeline['Joined'] || 0;
    const hiredCount = pipeline['Hired'] || 0;
    const rejectedCount = pipeline['Rejected'] || 0;
    const droppedCount = pipeline['Dropped'] || 0;
    const totalOfferPlusJoined = offerCount + joinedCount + hiredCount;
    const conversionRate = totalCandidates > 0 ? Math.round((totalOfferPlusJoined / totalCandidates) * 100) : 0;
    const rejectionRate = totalCandidates > 0 ? Math.round(((rejectedCount + droppedCount) / totalCandidates) * 100) : 0;

    res.status(200).json({
      totalCandidates,
      thisMonth: thisMonthCount,
      lastMonth: lastMonthCount,
      pendingReview,
      candidateTrend,
      conversionRate,
      rejectionRate,
      pipeline: [
        { stage: 'Applied', count: pipeline['Applied'] || 0 },
        { stage: 'Screening', count: pipeline['Screening'] || 0 },
        { stage: 'Interview', count: pipeline['Interview'] || 0 },
        { stage: 'Offer', count: pipeline['Offer'] || 0 },
        { stage: 'Hired', count: pipeline['Hired'] || 0 },
        { stage: 'Joined', count: pipeline['Joined'] || 0 },
        { stage: 'Rejected', count: pipeline['Rejected'] || 0 },
        { stage: 'Dropped', count: pipeline['Dropped'] || 0 }
      ],
      topPositions: topPositions.map(p => ({ position: p._id, count: p.count })),
      topSources: topSources.map(s => ({ source: s._id, count: s.count })),
      recentCandidates: recentCandidates.map(c => ({
        name: c.name,
        position: c.position,
        status: c.status,
        createdAt: c.createdAt,
        source: c.source
      })),
      dailySubmissions: dailyData,
      locationBreakdown: locationBreakdown.map(l => ({ location: l._id, count: l.count }))
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Error fetching dashboard stats', error: err.message });
  }
};