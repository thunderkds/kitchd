import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createComment, deleteComment, type CommentEntityType } from './api';
import { queryErrorMessage, useComments } from './queries';
import { commentKeys } from './queryKeys';
import { session } from './session';
import { useTheme } from './theme';

// Mirrors the controller's @Roles on POST/DELETE /comments (comments.service WRITE_ROLES): everyone but Viewer.
const COMMENT_WRITE_ROLES = ['OWNER', 'ADMIN', 'CHEF', 'STAFF'];

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

export function CommentsSection({ entityType, entityId }: { entityType: CommentEntityType; entityId: string }) {
  const queryClient = useQueryClient();
  const user = session.getUser();
  const canWrite = !!user && COMMENT_WRITE_ROLES.includes(user.role);
  const [draft, setDraft] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const { palette } = useTheme();

  const comments = useComments(entityType, entityId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: commentKeys.all });

  const postMutation = useMutation({
    mutationFn: ({ body, parentId }: { body: string; parentId?: string }) =>
      createComment({ entityType, entityId, body, ...(parentId ? { parentId } : {}) }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: invalidate,
  });

  const canPost = canWrite && draft.trim().length > 0 && !postMutation.isPending;

  const submit = () => {
    const body = draft.trim();
    if (!canWrite || !body || postMutation.isPending) return;
    setActionError(null);
    postMutation.mutate(replyTo ? { body, parentId: replyTo } : { body }, {
      onSuccess: () => {
        setDraft('');
        setReplyTo(null);
      },
      onError: (error) => setActionError(queryErrorMessage(error, 'Failed to post comment')),
    });
  };

  const remove = (id: string) => {
    setActionError(null);
    deleteMutation.mutate(id, {
      onError: (error) => setActionError(queryErrorMessage(error, 'Failed to delete comment')),
    });
  };

  const loadError = queryErrorMessage(comments.error, 'Failed to load comments');
  const items = comments.data ?? [];
  // Single-level threading (web Comments.tsx): replies group under a top-level parent; the API rejects replies to replies.
  const topLevel = items.filter((comment) => !comment.parentId);

  const renderComment = (comment: (typeof items)[number], isReply: boolean) => {
    const own = !!user && comment.authorId === user.id;
    return (
      <View
        key={comment.id}
        testID={`comment-${comment.id}`}
        style={[
          styles.comment,
          { backgroundColor: palette.background, borderColor: palette.border },
          isReply ? styles.reply : null,
        ]}
      >
        <Text style={[styles.author, { color: palette.muted }]}>
          {own ? 'You' : 'Team member'}
          {formatTimestamp(comment.createdAt) ? ` · ${formatTimestamp(comment.createdAt)}` : ''}
        </Text>
        <Text style={[styles.body, { color: palette.text }]} testID="comment-body">
          {comment.body}
        </Text>
        <View style={styles.actions}>
          {canWrite && !isReply && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reply to comment"
              testID={`reply-${comment.id}`}
              style={styles.actionButton}
              onPress={() => setReplyTo(comment.id)}
            >
              <Text style={[styles.actionText, { color: palette.accentSoft }]}>Reply</Text>
            </Pressable>
          )}
          {own && canWrite && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete comment"
              testID={`delete-${comment.id}`}
              style={styles.actionButton}
              onPress={() => remove(comment.id)}
              disabled={deleteMutation.isPending}
            >
              <Text style={[styles.actionText, { color: palette.danger }]}>Delete</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.section, { borderTopColor: palette.border }]}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>Comments</Text>

      {comments.isPending && <Text style={[styles.note, { color: palette.muted }]}>Loading comments...</Text>}
      {loadError && <Text style={[styles.error, { color: palette.danger }]}>{loadError}</Text>}
      {!comments.isPending && !loadError && items.length === 0 && <Text style={[styles.note, { color: palette.muted }]}>No comments yet.</Text>}

      {topLevel.map((comment) => (
        <View key={comment.id} style={styles.thread}>
          {renderComment(comment, false)}
          {items
            .filter((reply) => reply.parentId === comment.id)
            .map((reply) => renderComment(reply, true))}
        </View>
      ))}

      {actionError && <Text style={[styles.error, { color: palette.danger }]}>{actionError}</Text>}

      {canWrite && (
        <View style={styles.composer}>
          {replyTo && (
            <View style={styles.replyBanner}>
              <Text style={[styles.note, { color: palette.muted }]}>Replying to a comment</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
                style={styles.actionButton}
                onPress={() => setReplyTo(null)}
              >
                <Text style={[styles.actionText, { color: palette.accentSoft }]}>Cancel reply</Text>
              </Pressable>
            </View>
          )}
          <TextInput
            style={[styles.input, { color: palette.text, backgroundColor: palette.background, borderColor: palette.border }]}
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a comment... use @name to mention a teammate"
            placeholderTextColor={palette.muted}
            multiline
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canPost }}
            testID="post-button"
            style={[styles.postButton, { backgroundColor: palette.accent }, !canPost && styles.postButtonDisabled]}
            onPress={submit}
            disabled={!canPost}
          >
            <Text style={[styles.postButtonText, { color: palette.background }]}>Post</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// Colours come from useTheme().palette (applied inline); only layout lives here.
const styles = StyleSheet.create({
  section: {
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  note: {
    fontSize: 13,
  },
  error: {
    fontSize: 13,
  },
  thread: {
    gap: 8,
  },
  comment: {
    gap: 4,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  reply: {
    marginLeft: 16,
  },
  author: {
    fontSize: 12,
  },
  body: {
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  composer: {
    gap: 8,
  },
  input: {
    minHeight: 64,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    textAlignVertical: 'top',
  },
  postButton: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 20,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    fontWeight: '700',
  },
});
