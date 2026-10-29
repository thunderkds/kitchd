import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { CommentsSection } from './commentsSection'
import * as api from './api'
import { createQueryClient } from './queryClient'

let mockUser: { id: string; role: string } | null = { id: 'u1', role: 'CHEF' }

jest.mock('./session', () => ({
  session: { getUser: () => mockUser },
}))
jest.mock('./api', () => ({
  listComments: jest.fn(),
  createComment: jest.fn(),
  deleteComment: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>
const clients: ReturnType<typeof createQueryClient>[] = []

function renderSection() {
  const client = createQueryClient()
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <CommentsSection entityType="task" entityId="task-1" />
    </QueryClientProvider>,
  )
}

const comment = (over: Partial<api.CommentItem>): api.CommentItem => ({
  id: 'c1',
  entityType: 'task',
  entityId: 'task-1',
  authorId: 'u1',
  body: 'Mine',
  mentions: [],
  parentId: null,
  createdAt: '2026-10-29T10:00:00.000Z',
  ...over,
})

beforeEach(() => {
  mockUser = { id: 'u1', role: 'CHEF' }
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  for (const fn of Object.values(mocked).filter(jest.isMockFunction)) {
    ;(fn as jest.Mock).mockReset()
  }
})

describe('CommentsSection (M007)', () => {
  it('AC1: lists comments for the task in the order the API returns them (oldest first, like web)', async () => {
    mocked.listComments.mockResolvedValue([
      comment({ id: 'c1', body: 'First comment' }),
      comment({ id: 'c2', body: 'Second comment', authorId: 'u2' }),
    ])
    renderSection()

    expect(await screen.findByText('First comment')).toBeTruthy()
    expect(screen.getByText('Second comment')).toBeTruthy()
    expect(mocked.listComments).toHaveBeenCalledWith('task', 'task-1')
    const bodies = screen.getAllByTestId('comment-body').map((n) => n.props.children)
    expect(bodies).toEqual(['First comment', 'Second comment'])
  })

  it('AC1: shows an empty state', async () => {
    mocked.listComments.mockResolvedValue([])
    renderSection()
    expect(await screen.findByText('No comments yet.')).toBeTruthy()
  })

  it('AC2: posting calls createComment, clears the input and refreshes the list', async () => {
    mocked.listComments
      .mockResolvedValueOnce([])
      .mockResolvedValue([comment({ id: 'c9', body: 'Thanks @sam' })])
    mocked.createComment.mockResolvedValue(comment({ id: 'c9', body: 'Thanks @sam' }))
    renderSection()
    await screen.findByText('No comments yet.')

    fireEvent.changeText(screen.getByPlaceholderText(/Write a comment/), 'Thanks @sam')
    fireEvent.press(screen.getByText('Post'))

    await waitFor(() =>
      expect(mocked.createComment).toHaveBeenCalledWith({
        entityType: 'task',
        entityId: 'task-1',
        body: 'Thanks @sam',
      }),
    )
    expect(await screen.findByText('Thanks @sam', { exact: true })).toBeTruthy()
    expect(mocked.listComments).toHaveBeenCalledTimes(2)
    expect(screen.getByPlaceholderText(/Write a comment/).props.value).toBe('')
  })

  it('AC2: an empty or whitespace body is blocked client-side', async () => {
    mocked.listComments.mockResolvedValue([])
    renderSection()
    await screen.findByText('No comments yet.')

    fireEvent.press(screen.getByText('Post'))
    fireEvent.changeText(screen.getByPlaceholderText(/Write a comment/), '   \n ')
    fireEvent.press(screen.getByText('Post'))

    expect(mocked.createComment).not.toHaveBeenCalled()
  })

  it('AC2: shows the API error and keeps the draft when posting fails', async () => {
    mocked.listComments.mockResolvedValue([])
    mocked.createComment.mockRejectedValue(new Error('Boom'))
    renderSection()
    await screen.findByText('No comments yet.')

    fireEvent.changeText(screen.getByPlaceholderText(/Write a comment/), 'hello')
    fireEvent.press(screen.getByText('Post'))

    expect(await screen.findByText('Boom')).toBeTruthy()
    expect(screen.getByPlaceholderText(/Write a comment/).props.value).toBe('hello')
  })

  it('AC3: Delete appears only on the caller\'s own comments and calls deleteComment, then refreshes', async () => {
    mocked.listComments
      .mockResolvedValueOnce([
        comment({ id: 'c1', body: 'Mine', authorId: 'u1' }),
        comment({ id: 'c2', body: 'Theirs', authorId: 'u2' }),
      ])
      .mockResolvedValue([comment({ id: 'c2', body: 'Theirs', authorId: 'u2' })])
    mocked.deleteComment.mockResolvedValue({ id: 'c1' })
    renderSection()
    await screen.findByText('Mine')

    expect(screen.getAllByText('Delete')).toHaveLength(1)
    expect(screen.queryByTestId('delete-c2')).toBeNull()

    fireEvent.press(screen.getByTestId('delete-c1'))

    await waitFor(() => expect(mocked.deleteComment).toHaveBeenCalledWith('c1'))
    await waitFor(() => expect(screen.queryByText('Mine')).toBeNull())
    expect(screen.getByText('Theirs')).toBeTruthy()
  })

  it('AC4: VIEWER sees the thread but no composer and no Delete', async () => {
    mockUser = { id: 'u1', role: 'VIEWER' }
    mocked.listComments.mockResolvedValue([comment({ id: 'c1', body: 'Mine', authorId: 'u1' })])
    renderSection()

    expect(await screen.findByText('Mine')).toBeTruthy()
    expect(screen.queryByPlaceholderText(/Write a comment/)).toBeNull()
    expect(screen.queryByText('Post')).toBeNull()
    expect(screen.queryByText('Delete')).toBeNull()
  })

  it('shows the API error when loading fails', async () => {
    mocked.listComments.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }))
    renderSection()
    expect(await screen.findByText('Forbidden')).toBeTruthy()
  })
})
