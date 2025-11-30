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
    province_code?: string | null;
    district_code?: string | null;
    ward_code?: string | null;
  }>
): Promise<RecommendedUser[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout - giảm từ 120s để tránh browser timeout

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
