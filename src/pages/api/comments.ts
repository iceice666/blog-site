import type { APIRoute } from 'astro';
import { readSession, requireSession } from '../../lib/server/auth';
import { addComment, deleteComment, getDiscussion, parseCommentEntry } from '../../lib/server/github-discussions';
import { assertSameOrigin, json, jsonError, readJson } from '../../lib/server/http';

export const prerender = false;

interface CommentBody {
  entryType?: string;
  entryId?: string;
  title?: string;
  path?: string;
  body?: string;
  commentId?: string;
  replyToId?: string;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const entry = parseCommentEntry({
      entryType: url.searchParams.get('entryType'),
      entryId: url.searchParams.get('entryId'),
      title: url.searchParams.get('title'),
      path: url.searchParams.get('path'),
    });
    const session = await readSession(request);
    const discussion = await getDiscussion(entry, session?.accessToken);

    return json({
      discussion,
      user: session?.user ?? null,
    });
  } catch (error) {
    return jsonError(error);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    assertSameOrigin(request);
    const session = await requireSession(request);
    const body = await readJson<CommentBody>(request);
    const entry = parseCommentEntry(body);

    const replyToId = typeof body.replyToId === 'string' ? body.replyToId : undefined;
    const discussion = await addComment(entry, body.body ?? '', session.accessToken, replyToId);

    return json({ discussion, user: session.user }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    assertSameOrigin(request);
    const session = await requireSession(request);
    const body = await readJson<CommentBody>(request);
    const entry = parseCommentEntry(body);

    await deleteComment(entry, body.commentId ?? '', session.accessToken);
    const discussion = await getDiscussion(entry, session.accessToken);

    return json({ discussion, user: session.user });
  } catch (error) {
    return jsonError(error);
  }
};
