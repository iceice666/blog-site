import { env } from 'cloudflare:workers';
import { githubDiscussions, site } from '../../../config';
import { githubHeaders } from './github-auth';
import { getRequiredEnv, HttpError } from './http';

export type CommentEntryType = 'article' | 'post';

export interface CommentEntry {
  entryType: CommentEntryType;
  entryId: string;
  title: string;
  path: string;
}

export interface PublicComment {
  id: string;
  body: string;
  bodyHTML: string;
  bodyText: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  isMinimized: boolean;
  minimizedReason: string | null;
  viewerCanDelete: boolean;
  viewerDidAuthor: boolean;
  author: {
    login: string;
    avatarUrl: string;
    url: string;
  } | null;
}

export interface PublicDiscussion {
  id: string;
  number: number;
  title: string;
  url: string;
  totalCount: number;
  hasMore: boolean;
  comments: PublicComment[];
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

interface DiscussionNode {
  id: string;
  number: number;
  title: string;
  body: string;
  url: string;
  comments: {
    totalCount: number;
    pageInfo: {
      hasNextPage: boolean;
    };
    nodes: PublicComment[];
  };
}

interface FindDiscussionResponse {
  search: {
    nodes: Array<DiscussionNode | null>;
  };
}

interface DiscussionByIdResponse {
  node: DiscussionNode | null;
}

interface CreateDiscussionResponse {
  createDiscussion: {
    discussion: DiscussionNode;
  };
}

interface AddCommentResponse {
  addDiscussionComment: {
    comment: PublicComment;
  };
}

interface CommentContextResponse {
  node: null | {
    id: string;
    viewerCanDelete: boolean;
    discussion: {
      title: string;
      body: string;
    } | null;
  };
}

const COMMENT_FIELDS = `
  fragment CommentFields on DiscussionComment {
    id
    body
    bodyHTML
    bodyText
    createdAt
    updatedAt
    url
    isMinimized
    minimizedReason
    viewerCanDelete
    viewerDidAuthor
    author {
      login
      avatarUrl
      url
    }
  }
`;

const DISCUSSION_FIELDS = `
  ${COMMENT_FIELDS}
  fragment DiscussionFields on Discussion {
    id
    number
    title
    body
    url
    comments(first: 100) {
      totalCount
      pageInfo {
        hasNextPage
      }
      nodes {
        ...CommentFields
      }
    }
  }
`;

const FIND_DISCUSSION_QUERY = `
  ${DISCUSSION_FIELDS}
  query FindDiscussion($query: String!) {
    search(query: $query, type: DISCUSSION, first: 10) {
      nodes {
        ... on Discussion {
          ...DiscussionFields
        }
      }
    }
  }
`;

const DISCUSSION_BY_ID_QUERY = `
  ${DISCUSSION_FIELDS}
  query DiscussionById($id: ID!) {
    node(id: $id) {
      ... on Discussion {
        ...DiscussionFields
      }
    }
  }
`;

const CREATE_DISCUSSION_MUTATION = `
  ${DISCUSSION_FIELDS}
  mutation CreateDiscussion($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
    createDiscussion(input: { repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body }) {
      discussion {
        ...DiscussionFields
      }
    }
  }
`;

const ADD_COMMENT_MUTATION = `
  ${COMMENT_FIELDS}
  mutation AddDiscussionComment($discussionId: ID!, $body: String!) {
    addDiscussionComment(input: { discussionId: $discussionId, body: $body }) {
      comment {
        ...CommentFields
      }
    }
  }
`;

const COMMENT_CONTEXT_QUERY = `
  query CommentContext($id: ID!) {
    node(id: $id) {
      ... on DiscussionComment {
        id
        viewerCanDelete
        discussion {
          title
          body
        }
      }
    }
  }
`;

const DELETE_COMMENT_MUTATION = `
  mutation DeleteDiscussionComment($id: ID!) {
    deleteDiscussionComment(input: { id: $id }) {
      comment {
        id
      }
    }
  }
`;

export function parseCommentEntry(input: {
  entryType?: string | null;
  entryId?: string | null;
  title?: string | null;
  path?: string | null;
}): CommentEntry {
  const entryType = input.entryType;
  const entryId = (input.entryId ?? '').trim();
  const title = (input.title ?? entryId).trim() || entryId;
  const path = normalizePath(input.path);

  if (entryType !== 'article' && entryType !== 'post') {
    throw new HttpError(400, 'Invalid comment entry type.', 'bad_entry_type');
  }
  if (!entryId || entryId.length > 160 || /[\\/\u0000-\u001f]/u.test(entryId)) {
    throw new HttpError(400, 'Invalid comment entry id.', 'bad_entry_id');
  }

  return {
    entryType,
    entryId,
    title: title.slice(0, 180),
    path,
  };
}

export async function getDiscussion(entry: CommentEntry, token = getSiteToken()) {
  return findDiscussion(token, entry);
}

export async function addComment(entry: CommentEntry, body: string, userToken: string) {
  const trimmedBody = body.trim();
  if (!trimmedBody) throw new HttpError(400, 'Comment body is required.', 'empty_comment');
  if (trimmedBody.length > 4_000) {
    throw new HttpError(400, 'Comment body is too long.', 'comment_too_long');
  }

  const discussion = await getOrCreateDiscussion(entry);
  await githubGraphQL<AddCommentResponse>(userToken, ADD_COMMENT_MUTATION, {
    discussionId: discussion.id,
    body: trimmedBody,
  });

  return getDiscussionById(userToken, discussion.id);
}

export async function deleteComment(entry: CommentEntry, commentId: string, userToken: string) {
  if (!commentId) throw new HttpError(400, 'Comment id is required.', 'missing_comment_id');

  const context = await githubGraphQL<CommentContextResponse>(userToken, COMMENT_CONTEXT_QUERY, { id: commentId });
  if (!context.node?.discussion) {
    throw new HttpError(404, 'Comment was not found.', 'comment_not_found');
  }
  if (!context.node.viewerCanDelete) {
    throw new HttpError(403, 'You cannot delete this comment.', 'comment_delete_forbidden');
  }
  if (context.node.discussion.title !== discussionTitle(entry) || !context.node.discussion.body.includes(discussionMarker(entry))) {
    throw new HttpError(403, 'Comment does not belong to this page.', 'wrong_discussion');
  }

  await githubGraphQL(userToken, DELETE_COMMENT_MUTATION, { id: commentId });
}

function getSiteToken() {
  return getRequiredEnv(env, 'GITHUB_TOKEN');
}

async function getOrCreateDiscussion(entry: CommentEntry) {
  const siteToken = getSiteToken();
  const existing = await findDiscussion(siteToken, entry);
  if (existing) return existing;

  const data = await githubGraphQL<CreateDiscussionResponse>(siteToken, CREATE_DISCUSSION_MUTATION, {
    repositoryId: githubDiscussions.repoId,
    categoryId: githubDiscussions.categoryId,
    title: discussionTitle(entry),
    body: discussionBody(entry),
  });
  return toPublicDiscussion(data.createDiscussion.discussion);
}

async function findDiscussion(token: string, entry: CommentEntry) {
  const data = await githubGraphQL<FindDiscussionResponse>(token, FIND_DISCUSSION_QUERY, {
    query: `repo:${githubDiscussions.repo} in:title "${escapeSearchText(discussionTitle(entry))}"`,
  });
  const node = data.search.nodes.find((discussion) => {
    return discussion?.title === discussionTitle(entry) && discussion.body.includes(discussionMarker(entry));
  });
  return node ? toPublicDiscussion(node) : null;
}

async function getDiscussionById(token: string, id: string) {
  const data = await githubGraphQL<DiscussionByIdResponse>(token, DISCUSSION_BY_ID_QUERY, { id });
  if (!data.node) throw new HttpError(404, 'Discussion was not found after posting.', 'discussion_not_found');
  return toPublicDiscussion(data.node);
}

function toPublicDiscussion(discussion: DiscussionNode): PublicDiscussion {
  return {
    id: discussion.id,
    number: discussion.number,
    title: discussion.title,
    url: discussion.url,
    totalCount: discussion.comments.totalCount,
    hasMore: discussion.comments.pageInfo.hasNextPage,
    comments: discussion.comments.nodes.filter(Boolean),
  };
}

async function githubGraphQL<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      ...githubHeaders(token),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json()) as GraphQLResponse<T>;
  if (!response.ok || payload.errors?.length || !payload.data) {
    const message = payload.errors?.map((error) => error.message).filter(Boolean).join('; ');
    throw new HttpError(response.ok ? 502 : response.status, message || 'GitHub GraphQL request failed.', 'github_graphql_failed');
  }

  return payload.data;
}

function discussionTitle(entry: CommentEntry) {
  return `Comments: ${entry.entryType}/${entry.entryId}`;
}

function discussionMarker(entry: CommentEntry) {
  return `justaslime-comments:${entry.entryType}:${entry.entryId}`;
}

function discussionBody(entry: CommentEntry) {
  const url = new URL(entry.path, site.url).toString();
  return [
    `<!-- ${discussionMarker(entry)} -->`,
    '',
    `Comment thread for [${entry.title}](${url}) on ${site.title}.`,
    '',
    'This discussion is managed by the custom comment UI on justaslime.dev.',
  ].join('\n');
}

function normalizePath(path: string | null | undefined) {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return '/';
  try {
    const url = new URL(path, site.url);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

function escapeSearchText(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}
