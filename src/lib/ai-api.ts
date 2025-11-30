/**
 * Client để gọi Python AI API cho recommendations
 * Sử dụng Hugging Face BGE-M3 model
 */

const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8001";

export interface RecommendedUser {
  id: string;
  username: string;
  displayName: string;
  similarity: number;
}

export interface RecommendedPost {
  id: string;
  content: string;
  userId: string;
  similarity: number;
}

/**
 * Recommend friends dựa trên content similarity (Hugging Face embeddings)
 */
export async function recommendFriends(
  userId: string,
  users: Array<{
    id: string;
    username: string;
    displayName: string;
    post_contents: string[];
    liked_post_contents: string[];
    comment_contents: string[];
    following_ids: string[];
  }>
): Promise<RecommendedUser[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout (2 phút) - vì Python API cần thời gian xử lý embeddings

  try {
    const response = await fetch(`${PYTHON_API_URL}/recommend-friends/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        users: users, // following_ids is already an array
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Python API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Python API request timeout (120s)");
    }
    console.error("Error calling Python AI API for friends:", error);
    throw error;
  }
}

/**
 * Recommend similar posts dựa trên content similarity (Hugging Face embeddings)
 */
export async function recommendSimilarPosts(
  postId: string,
  posts: Array<{
    id: string;
    content: string;
    userId: string;
    comment_contents: string[];
  }>
): Promise<RecommendedPost[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout (2 phút)

  try {
    const response = await fetch(`${PYTHON_API_URL}/recommend-similar-posts/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_id: postId,
        posts,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Python API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Python API request timeout (120s)");
    }
    console.error("Error calling Python AI API for posts:", error);
    throw error;
  }
}

/**
 * Recommend posts for user dựa trên user interactions (posts, likes, comments)
 */
export async function recommendPostsForUser(
  userId: string,
  userData: {
    id: string;
    username: string;
    displayName: string;
    post_contents: string[];
    liked_post_contents: string[];
    comment_contents: string[];
    following_ids: string[];
  },
  posts: Array<{
    id: string;
    content: string;
    userId: string;
    comment_contents: string[];
  }>,
  excludePostIds: string[] = []
): Promise<RecommendedPost[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout

  try {
    const response = await fetch(
      `${PYTHON_API_URL}/recommend-posts-for-user/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          user_data: userData,
          posts,
          exclude_post_ids: excludePostIds,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[ai-api] Python API error (${response.status}):`,
        errorText
      );
      throw new Error(
        `Python API error: ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    console.log(
      `[ai-api] Python API returned ${Array.isArray(data) ? data.length : "non-array"} items`
    );
    if (Array.isArray(data) && data.length > 0) {
      console.log(`[ai-api] Sample recommendation:`, data[0]);
    }
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Python API request timeout (120s)");
    }
    console.error(
      "[ai-api] Error calling Python AI API for user posts:",
      error
    );
    throw error;
  }
}

/**
 * Health check Python API
 */
export async function checkPythonAPIHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${PYTHON_API_URL}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}
