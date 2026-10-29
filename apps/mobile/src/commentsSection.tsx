import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createComment, deleteComment, type CommentEntityType } from './api';
import { queryErrorMessage, useComments } from './queries';
import { commentKeys } from './queryKeys';
import { session } from './session';

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

  const comments = useComments(entityType, entityId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: commentKeys.all });

  const postMutation = useMutation({
    mutationFn: (body: string) => createComment({ entityType, entityId, body }),
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
    postMutation.mutate(body, {
      onSuccess: () => setDraft(''),
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

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Comments</Text>

      {comments.isPending && <Text style={styles.note}>Loading comments...</Text>}
      {loadError && <Text style={styles.error}>{loadError}</Text>}
      {!comments.isPending && !loadError && items.length === 0 && <Text style={styles.note}>No comments yet.</Text>}

      {items.map((comment) => {
        const own = !!user && comment.authorId === user.id;
        return (
          <View key={comment.id} style={[styles.comment, comment.parentId ? styles.reply : null]}>
            <Text style={styles.author}>
              {own ? 'You' : 'Team member'}
              {formatTimestamp(comment.createdAt) ? ` · ${formatTimestamp(comment.createdAt)}` : ''}
            </Text>
            <Text style={styles.body} testID="comment-body">
              {comment.body}
            </Text>
            {own && canWrite && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete comment"
                testID={`delete-${comment.id}`}
                style={styles.deleteButton}
                onPress={() => remove(comment.id)}
                disabled={deleteMutation.isPending}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            )}
          </View>
        );
      })}

      {actionError && <Text style={styles.error}>{actionError}</Text>}

      {canWrite && (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a comment... use @name to mention a teammate"
            placeholderTextColor="#7f8ba3"
            multiline
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canPost }}
            style={[styles.postButton, !canPost && styles.postButtonDisabled]}
            onPress={submit}
            disabled={!canPost}
          >
            <Text style={styles.postButtonText}>Post</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#222b3a',
  },
  sectionTitle: {
    color: '#f4f7ff',
    fontSize: 16,
    fontWeight: '700',
  },
  note: {
    color: '#9aa7c2',
    fontSize: 13,
  },
  error: {
    color: '#ff8a8a',
    fontSize: 13,
  },
  comment: {
    gap: 4,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: '#2d374b',
  },
  reply: {
    marginLeft: 16,
  },
  author: {
    color: '#9aa7c2',
    fontSize: 12,
  },
  body: {
    color: '#f4f7ff',
    fontSize: 14,
  },
  deleteButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  deleteText: {
    color: '#ff8a8a',
    fontSize: 13,
    fontWeight: '700',
  },
  composer: {
    gap: 8,
  },
  input: {
    minHeight: 64,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f4f7ff',
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: '#2d374b',
    textAlignVertical: 'top',
  },
  postButton: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 20,
    backgroundColor: '#6b8cff',
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: '#0d1016',
    fontWeight: '700',
  },
});
