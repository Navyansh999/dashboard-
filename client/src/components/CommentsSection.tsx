import React, { useState } from 'react';
import { Comment } from '../types';
import { useAuth } from '../context/AuthContext';
import { Send } from 'lucide-react';

interface CommentsSectionProps {
  comments: Comment[];
  onAddComment: (body: string) => Promise<void>;
  isLoading?: boolean;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  comments,
  onAddComment,
  isLoading
}) => {
  const { currentUser } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddComment(commentText);
      setCommentText('');
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString();
  };

  return (
    <div>
      {/* Comments List */}
      <div style={{ marginBottom: '16px' }}>
        {comments.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
            No comments yet. Start the discussion below.
          </div>
        ) : (
          comments.map((comm) => (
            <div
              key={comm.id}
              style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '14px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '12px'
              }}
            >
              <img
                src={comm.user_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={comm.user_name}
                style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#ffffff' }}>
                    {comm.user_name || 'Team Member'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    {formatDate(comm.created_at)}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.45', margin: 0 }}>
                  {comm.body}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Post Comment Input */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={`Add a note or update as ${currentUser?.name || 'team member'}...`}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            color: '#ffffff',
            fontSize: '0.85rem',
            outline: 'none'
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border-subtle)')}
        />
        <button
          type="submit"
          disabled={!commentText.trim() || isSubmitting}
          className="btn btn-primary"
          style={{ padding: '0 16px' }}
        >
          <Send size={15} />
          <span>Post</span>
        </button>
      </form>
    </div>
  );
};
