/**
 * Team Comments Page
 * ===================
 * Real-time team collaboration on candidates with @mention support.
 * Comments are stored per-candidate and support delete with confirmation.
 */
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send, AtSign, Users, Trash2 } from 'lucide-react';
import { CandidateSelector } from '@/components/ui/CandidateSelector';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatDistanceToNow } from 'date-fns';
import { useLocale } from '@/components/providers/LocaleProvider';

interface Comment {
  id: string;
  candidateId: string;
  authorName: string;
  body: string;
  createdAt: string;
  mentions: string[];
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  position?: string;
}

const TEAM_MEMBERS = ['john', 'sarah', 'mike', 'lisa', 'alex', 'emma', 'david'];

export default function TeamCommentsPage() {
  const { t } = useLocale();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; commentId: string } | null>(null);
  const toast = useToast();

  useEffect(() => {
    fetchCandidates();
  }, []);

  useEffect(() => {
    if (selectedCandidate) {
      fetchComments(selectedCandidate.id);
    }
  }, [selectedCandidate]);

  const fetchCandidates = async () => {
    try {
      const res = await fetch('/api/candidates', { credentials: 'include' });
      const data = await res.json();
      setCandidates(data.candidates || []);
      if (data.candidates?.length > 0) {
        setSelectedCandidate(data.candidates[0]);
      }
    } catch {
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (candidateId: string) => {
    try {
      const res = await fetch(`/api/candidates/${candidateId}/comments`, { credentials: 'include' });
      const data = await res.json();
      setComments(data.comments || []);
    } catch {
      setComments([]);
    }
  };

  const selectCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewComment(value);
    
    // Check for @mentions
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
      setShowMentions(true);
      setMentionSearch('');
    } else if (lastAtIndex !== -1) {
      const afterAt = value.slice(lastAtIndex + 1);
      if (!afterAt.includes(' ')) {
        setShowMentions(true);
        setMentionSearch(afterAt);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (username: string) => {
    const lastAtIndex = newComment.lastIndexOf('@');
    const before = newComment.slice(0, lastAtIndex);
    const after = newComment.slice(lastAtIndex + mentionSearch.length + 1);
    setNewComment(`${before}@${username} ${after}`);
    setShowMentions(false);
  };

  const submitComment = async () => {
    if (!newComment.trim() || !selectedCandidate) return;

    setSubmitting(true);
    const mentions = newComment.match(/@(\w+)/g)?.map(m => m.slice(1)) || [];

    try {
      const res = await fetch(`/api/candidates/${selectedCandidate.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          authorName: 'HR Manager',
          body: newComment,
          mentions,
        }),
      });

      if (res.ok) {
        const newCommentData = await res.json();
        setComments([newCommentData, ...comments]);
        setNewComment('');
        toast.success('Comment added');
      } else {
        toast.error('Failed to add comment');
      }
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!selectedCandidate) return;
    try {
      const res = await fetch(`/api/candidates/${selectedCandidate.id}/comments?commentId=${commentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setComments(comments.filter(c => c.id !== commentId));
        toast.success('Comment deleted');
      }
    } catch {
      toast.error('Failed to delete comment');
    }
  };

  const filteredMembers = TEAM_MEMBERS.filter(m => 
    m.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const renderCommentBody = (body: string) => {
    const parts = body.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-brand-100 text-brand-700 rounded font-semibold text-sm">
            <AtSign className="w-3 h-3" />
            {part.slice(1)}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
    <PageShell>
      <PageHeader
        icon={MessageSquare}
        title="Team Comments"
        subtitle="Collaborate with your team using @mentions"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left - Candidate Selector */}
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-sm">
            <h3 className="font-bold text-stone-900 mb-3 flex items-center gap-2 text-sm">
              <Users className="w-5 h-5 text-brand-600" />
              Select Candidate
            </h3>
            <CandidateSelector
              candidates={candidates}
              selected={selectedCandidate}
              onSelect={(c) => selectCandidate(c as Candidate)}
              subtitle="position"
            />
          </div>

          {/* Team Members */}
          <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-sm">
            <h3 className="font-bold text-stone-900 mb-3">Team Members</h3>
            <p className="text-xs text-stone-500 mb-3">Type @ to mention in comments</p>
            <div className="flex flex-wrap gap-2">
              {TEAM_MEMBERS.map((member) => (
                <span key={member} className="inline-flex items-center gap-1 px-2 py-1 bg-stone-100 text-stone-700 rounded-lg text-xs font-medium">
                  <AtSign className="w-3 h-3" />
                  {member}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right - Comments */}
        <div className="lg:col-span-2">
          <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-sm min-h-[500px]">
            <h3 className="font-bold text-stone-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand-600" />
              Comments
            </h3>

            {/* Comment Input */}
            <div className="relative mb-6">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newComment}
                    onChange={handleInputChange}
                    onKeyDown={(e) => e.key === 'Enter' && !showMentions && submitComment()}
                    placeholder="Add a comment... Use @ to mention team members"
                    className="w-full px-4 py-3 pr-10 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                  <AtSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={submitComment}
                  disabled={submitting || !newComment.trim()}
                  className="px-4 py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[44px]"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </motion.button>
              </div>

              {/* Mention Dropdown */}
              {showMentions && filteredMembers.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-48 rounded-xl border border-stone-200 bg-white shadow-lg z-10 py-1">
                  {filteredMembers.map((member) => (
                    <button
                      key={member}
                      onClick={() => insertMention(member)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-stone-50 flex items-center gap-2"
                    >
                      <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                        {member[0].toUpperCase()}
                      </div>
                      @{member}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Comments List */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                  <p className="text-stone-500">No comments yet</p>
                  <p className="text-sm text-stone-400 mt-1">Be the first to comment!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="p-4 rounded-xl bg-stone-50 border border-stone-100">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center font-bold text-brand-700 text-sm flex-shrink-0">
                        {comment.authorName?.[0] || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-stone-900 text-sm">{comment.authorName}</span>
                          <span className="text-xs text-stone-400">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-stone-700 leading-relaxed break-words">
                          {renderCommentBody(comment.body)}
                        </p>
                      </div>
                      <button
                        onClick={() => setDeleteConfirm({ open: true, commentId: comment.id })}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- Section: Delete Comment Confirm Modal --- */}
      <ConfirmModal
        open={!!deleteConfirm?.open}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm?.commentId) deleteComment(deleteConfirm.commentId);
          setDeleteConfirm(null);
        }}
        title="Delete Comment"
        description="Are you sure you want to delete this comment? This action cannot be undone."
        confirmLabel="Delete Comment"
        cancelLabel="Cancel"
        variant="danger"
      />
    </PageShell>
    </motion.div>
  );
}
