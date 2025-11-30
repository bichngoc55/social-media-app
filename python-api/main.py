"""
FastAPI server cho AI Recommendations
- Recommend friends dựa trên content similarity
- Recommend similar posts

Chạy: uvicorn main:app --reload --port 8001
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Optional, Set
import os
from dotenv import load_dotenv
import logging

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Recommendations API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("NEXT_PUBLIC_BASE_URL", "http://localhost:3000"),
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model
# BGE-M3: ~2.27GB, multilingual, best quality
# BGE-Small: ~130MB, English only, faster
# Có thể thay đổi bằng cách set env variable: MODEL_NAME=BAAI/bge-small-en-v1.5
model_name = os.getenv("MODEL_NAME", "BAAI/bge-m3")
logger.info(f"Loading model: {model_name}...")
logger.info("Note: First time download will take time (~2.27GB for BGE-M3, ~130MB for BGE-Small)")

try:
    model = SentenceTransformer(model_name)
    logger.info(f"Model {model_name} loaded successfully!")
except Exception as e:
    logger.error(f"Error loading model: {e}")
    raise

# Minimal Pydantic models (dựa trên schema Prisma, chỉ fields cần cho recommend)
class UserData(BaseModel):
    id: str
    username: str
    displayName: str
    post_contents: List[str]  # Own posts contents
    liked_post_contents: List[str]  # Contents of liked posts
    comment_contents: List[str]  # Own comments contents
    following_ids: Set[str]  # IDs đang follow (để exclude)


class PostData(BaseModel):
    id: str
    content: str
    userId: str
    comment_contents: List[str]  # Comments on this post


# Input for recommend friends
class RecommendFriendsInput(BaseModel):
    user_id: str
    users: List[UserData]  # All relevant users data (including target)


# Input for recommend similar posts
class RecommendSimilarPostsInput(BaseModel):
    post_id: str
    posts: List[PostData]  # All relevant posts data (including target)


# Input for recommend posts for user (based on user interactions)
class RecommendPostsForUserInput(BaseModel):
    user_id: str
    user_data: UserData  # User's own posts, likes, comments
    posts: List[PostData]  # Candidate posts to recommend from
    exclude_post_ids: Set[str] = set()  # Post IDs to exclude (already shown)


# -------------------- Helper Functions --------------------

def get_user_embedding(user: UserData) -> np.ndarray:
    """Tạo embedding cho user từ contents (posts, liked posts, comments)"""
    contents = user.post_contents + user.liked_post_contents + user.comment_contents
    if not contents:
        # Dimension của model (BGE-M3: 1024, BGE-Small: 384)
        embedding_dim = model.get_sentence_embedding_dimension()
        return np.zeros(embedding_dim)
    embeddings = model.encode(contents)
    return np.mean(embeddings, axis=0)


def get_post_embedding(post: PostData) -> np.ndarray:
    """Tạo embedding cho post từ content và comments"""
    contents = [post.content] + post.comment_contents
    if not contents:
        # Dimension của model (BGE-M3: 1024, BGE-Small: 384)
        embedding_dim = model.get_sentence_embedding_dimension()
        return np.zeros(embedding_dim)
    embeddings = model.encode(contents)
    return np.mean(embeddings, axis=0)


# -------------------- API Endpoints --------------------

@app.get("/")
async def root():
    return {"message": "AI Recommendations API is running", "model": "BAAI/bge-m3"}


@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": model is not None}


@app.post("/recommend-friends/")
async def recommend_friends(input_data: RecommendFriendsInput):
    """
    Recommend friends dựa trên content similarity
    
    Args:
        input_data: User ID và list users data
        
    Returns:
        List of recommended users với similarity scores
    """
    try:
        # Build embeddings
        user_embeddings: Dict[str, np.ndarray] = {}
        user_map: Dict[str, UserData] = {}
        
        logger.info(f"Building embeddings for {len(input_data.users)} users...")
        
        for user in input_data.users:
            user_embeddings[user.id] = get_user_embedding(user)
            user_map[user.id] = user

        if input_data.user_id not in user_embeddings:
            raise HTTPException(404, "Target user not found in data")

        target_emb = user_embeddings[input_data.user_id].reshape(1, -1)
        similarities = {}
        following = user_map[input_data.user_id].following_ids

        logger.info(f"Calculating similarities for user {input_data.user_id}...")

        for uid, emb in user_embeddings.items():
            if uid != input_data.user_id and uid not in following:
                sim = cosine_similarity(target_emb, emb.reshape(1, -1))[0][0]
                if sim > 0.1:  # Giảm threshold từ 0.3 xuống 0.1 để có nhiều recommendations hơn
                    similarities[uid] = sim

        # Top N
        top = 5  # Có thể thêm param nếu cần
        suggested = sorted(similarities.items(), key=lambda x: x[1], reverse=True)[:top]
        
        result = []
        for uid, score in suggested:
            user = user_map[uid]
            result.append({
                "id": uid,
                "username": user.username,
                "displayName": user.displayName,
                "similarity": round(float(score), 4)
            })

        logger.info(f"Found {len(result)} recommendations for user {input_data.user_id}")
        return result

    except Exception as e:
        logger.error(f"Error in recommend_friends: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/recommend-similar-posts/")
async def recommend_similar_posts(input_data: RecommendSimilarPostsInput):
    """
    Recommend similar posts dựa trên content similarity
    
    Args:
        input_data: Post ID và list posts data
        
    Returns:
        List of similar posts với similarity scores
    """
    try:
        # Build embeddings
        post_embeddings: Dict[str, np.ndarray] = {}
        post_map: Dict[str, PostData] = {}
        
        logger.info(f"Building embeddings for {len(input_data.posts)} posts...")

        for post in input_data.posts:
            post_embeddings[post.id] = get_post_embedding(post)
            post_map[post.id] = post

        if input_data.post_id not in post_embeddings:
            raise HTTPException(404, "Target post not found in data")

        target_emb = post_embeddings[input_data.post_id].reshape(1, -1)
        similarities = {}

        logger.info(f"Calculating similarities for post {input_data.post_id}...")

        for pid, emb in post_embeddings.items():
            if pid != input_data.post_id:
                sim = cosine_similarity(target_emb, emb.reshape(1, -1))[0][0]
                if sim > 0.3:  # Threshold
                    similarities[pid] = sim

        # Top N
        top = 5
        suggested = sorted(similarities.items(), key=lambda x: x[1], reverse=True)[:top]
        
        result = []
        for pid, score in suggested:
            post = post_map[pid]
            result.append({
                "id": pid,
                "content": post.content,
                "userId": post.userId,
                "similarity": round(float(score), 4)
            })

        logger.info(f"Found {len(result)} similar posts for post {input_data.post_id}")
        return result

    except Exception as e:
        logger.error(f"Error in recommend_similar_posts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/recommend-posts-for-user/")
async def recommend_posts_for_user(input_data: RecommendPostsForUserInput):
    """
    Recommend posts cho user dựa trên user interactions (posts, likes, comments)
    
    Args:
        input_data: User ID, user data, và list candidate posts
        
    Returns:
        List of recommended posts với similarity scores (sorted by similarity)
    """
    try:
        # Build user embedding từ interactions
        logger.info(f"Building user embedding for user {input_data.user_id}...")
        user_embedding = get_user_embedding(input_data.user_data)
        
        # Build post embeddings - TỐI ƯU: encode tất cả trong một batch
        post_embeddings: Dict[str, np.ndarray] = {}
        post_map: Dict[str, PostData] = {}
        
        # Filter và collect posts
        valid_posts = []
        for post in input_data.posts:
            # Exclude posts đã được hiển thị và posts của chính user
            if post.id in input_data.exclude_post_ids or post.userId == input_data.user_id:
                continue
            valid_posts.append(post)
            post_map[post.id] = post
        
        if not valid_posts:
            logger.warning("No candidate posts available after filtering")
            return []
        
        logger.info(f"Building embeddings for {len(valid_posts)} candidate posts (batch mode)...")
        
        # Collect all contents for batch encoding
        all_contents = []
        content_to_post_map = []  # Map từng content đến post ID
        
        for post in valid_posts:
            contents = [post.content] + post.comment_contents
            if not contents:
                # Nếu post không có content, tạo empty embedding sau
                content_to_post_map.append((post.id, []))
            else:
                start_idx = len(all_contents)
                all_contents.extend(contents)
                end_idx = len(all_contents)
                content_to_post_map.append((post.id, list(range(start_idx, end_idx))))
        
        # Map embeddings về từng post
        embedding_dim = model.get_sentence_embedding_dimension()
        
        # Encode tất cả contents trong một batch lớn
        if all_contents:
            logger.info(f"Encoding {len(all_contents)} contents in batch...")
            all_embeddings = model.encode(all_contents, batch_size=32, show_progress_bar=False)
        else:
            # Nếu không có contents nào, tạo empty array với đúng shape
            all_embeddings = np.array([]).reshape(0, embedding_dim)
        for post_id, content_indices in content_to_post_map:
            if not content_indices:
                # Post không có content, tạo zero embedding
                post_embeddings[post_id] = np.zeros(embedding_dim)
            else:
                # Lấy embeddings của post này và tính mean
                post_content_embeddings = all_embeddings[content_indices]
                post_embeddings[post_id] = np.mean(post_content_embeddings, axis=0)

        if not post_embeddings:
            logger.warning("No candidate posts available after filtering")
            return []

        # Calculate similarities
        user_emb = user_embedding.reshape(1, -1)
        similarities = {}

        logger.info(f"Calculating similarities for {len(post_embeddings)} posts...")

        for pid, emb in post_embeddings.items():
            sim = cosine_similarity(user_emb, emb.reshape(1, -1))[0][0]
            if sim > 0.1:  # Threshold để có nhiều recommendations hơn
                similarities[pid] = sim

        # Sort by similarity và return all (không limit ở đây, để Next.js handle pagination)
        suggested = sorted(similarities.items(), key=lambda x: x[1], reverse=True)
        
        result = []
        for pid, score in suggested:
            post = post_map[pid]
            result.append({
                "id": pid,
                "content": post.content,
                "userId": post.userId,
                "similarity": round(float(score), 4)
            })

        logger.info(f"Found {len(result)} recommended posts for user {input_data.user_id}")
        return result

    except Exception as e:
        logger.error(f"Error in recommend_posts_for_user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

