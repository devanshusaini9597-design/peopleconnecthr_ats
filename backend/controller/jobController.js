const Job = require('../models/Job');
const { normalizeText } = require('../utils/textNormalize');

// NOTE: this controller is currently NOT mounted in server.js (server.js has
// its own inline /jobs routes). It's kept scoped/authenticated here so it's
// safe to wire up later without re-introducing the unscoped-access bug it
// used to have (no organizationId, no createdBy, no auth check at all).

// 1. Create a New Job
exports.createJob = async (req, res) => {
    try {
        if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
        const { role, location, ctc, experience, skills, description, hiringManagers, isTemplate } = req.body;

        const newJob = new Job({
            role: normalizeText(role),
            location: normalizeText(location),
            ctc,
            experience,
            skills,
            description,
            hiringManagers,
            isTemplate: isTemplate || false,
            createdBy: req.user.id,
            organizationId: req.user.organizationId
        });

        const savedJob = await newJob.save();
        res.status(201).json(savedJob);
    } catch (error) {
        res.status(500).json({ message: "Error creating job", error: error.message });
    }
};

// 2. Get All Jobs (With optional filtering, scoped to the caller's organization)
exports.getJobs = async (req, res) => {
    try {
        if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
        const { isTemplate, managerEmail } = req.query;
        let query = req.user.organizationId ? { organizationId: req.user.organizationId } : { createdBy: req.user.id };

        if (isTemplate !== undefined) {
            query.isTemplate = isTemplate === 'true';
        }

        if (managerEmail) {
            query.hiringManagers = { $in: [managerEmail] };
        }

        const jobs = await Job.find(query).sort({ createdAt: -1 });
        res.status(200).json(jobs);
    } catch (error) {
        res.status(500).json({ message: "Error fetching jobs", error: error.message });
    }
};

// 3. Delete Job (scoped to the caller's organization)
exports.deleteJob = async (req, res) => {
    try {
        if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
        const scope = req.user.organizationId ? { organizationId: req.user.organizationId } : { createdBy: req.user.id };
        const deleted = await Job.findOneAndDelete({ _id: req.params.id, ...scope });
        if (!deleted) return res.status(404).json({ message: 'Job not found' });
        res.status(200).json({ message: "Job deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting job", error: error.message });
    }
};
