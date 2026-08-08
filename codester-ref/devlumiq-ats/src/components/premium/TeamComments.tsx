'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, AtSign, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/components/ui/Toast';

interface Comment {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  mentions?: string[];
}

interface TeamCommentsProps {
  candidateId: string;
  initialComments?: Comment[];
}

const TEAM_MEMBERS = ['john', 'sarah', 'mike', 'lisa', 'alex', 'emma'];

export function TeamComments({ candidateId, initialComments = [] }: TeamCommentsProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const filteredMembers = TEAM_MEMBERS.filter(m => 
    m.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart || 0;
    setNewComment(value);
    setCursorPosition(cursor);

    // Check if we're typing a mention
    const beforeCursor = value.slice(0, cursor);
    const atIndex = beforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1 && atIndex === beforeCursor.length - 1) {
      setShowMentions(true);
      setMentionSearch('');
    } else if (atIndex !== -1 && !beforeCursor.slice(atIndex).includes(' ')) {
      setShowMentions(true);
      setMentionSearch(beforeCursor.slice(atIndex + 1));
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (username: string) => {
    const beforeCursor = newComment.slice(0, cursorPosition);
    const atIndex = beforeCursor.lastIndexOf('@');
    const beforeMention = newComment.slice(0, atIndex);
    const afterCursor = newComment.slice(cursorPosition);
    
    const newValue = `${beforeMention}@${username} ${afterCursor}`;
    setNewComment(newValue);
    setShowMentions(false);
    
    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursor = atIndex + username.length + 2;
      inputRef.current?.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const submitComment = async () => {
    const body = newComment.trim();
    if (!body || !candidateId) return;

    setSubmitting(true);
    const userName = typeof window !== 'undefined' 
      ? (localStorage.getItem('userName') || 'Recruiter') 
      : 'Recruiter';
    
    // Extract mentions
    const mentions = body.match(/@(\w+)/g)?.map(m => m.slice(1)) || [];

    try {
      const res = await fetch(`/api/candidates/${candidateId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ authorName: userName, body, mentions }),
      });
      
      const data = await res.json();
      if (data) {
        setComments(prev => [data, ...prev]);
        setNewComment('');
        toast.success('Comment added');
      }
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCommentBody = (body: string) => {
    const parts = body.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="inline-flex items-center gap-1 text-brand-600 font-semibold bg-brand-50 px-1.5 py-0.5 rounded mx-0.5">
            <AtSign className="w-3 h-3" />
            {part.slice(1)}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-4">
      {/* Comments List */}
      <AnimatePresence>
        {comments.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <MessageSquare className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-600 font-medium">No comments yet</p>
            <p className="text-sm text-stone-500">Be the first to comment!</p>
          </motion.div>
        ) : (
          comments.map((comment, index) => (
            <motion.div
              key={comment.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 rounded-xl border border-stone-200 bg-white hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center text-brand-700 font-bold text-sm flex-shrink-0">
                  {comment.authorName[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-stone-900">{comment.authorName}</span>
                    <span className="text-xs text-stone-400">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-stone-700 leading-relaxed">
                    {renderCommentBody(comment.body)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </AnimatePresence>

      {/* Comment Input */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={newComment}
              onChange={handleInputChange}
              placeholder="Add a comment... Use @ to mention"
              className="w-full px-4 py-3 pr-10 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitComment();
                }
              }}
            />
            <AtSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={submitComment}
            disabled={submitting || !newComment.trim()}
            className="px-4 py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[44px]"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </motion.button>
        </div>

        {/* Mention Dropdown */}
        <AnimatePresence>
          {showMentions && filteredMembers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-0 mb-2 w-48 rounded-xl border border-stone-200 bg-white shadow-lg z-20 py-1 max-h-48 overflow-auto"
            >
              {filteredMembers.map((member) => (
                <button
                  key={member}
                  onClick={() => insertMention(member)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-stone-50 flex items-center gap-2 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center text-brand-700 text-xs font-bold">
                    {member[0].toUpperCase()}
                  </div>
                  <span className="text-stone-700">@{member}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
