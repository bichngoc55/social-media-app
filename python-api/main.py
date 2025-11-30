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
    province_code: Optional[str] = None  # Mã tỉnh/thành phố
    district_code: Optional[str] = None  # Mã quận/huyện
    ward_code: Optional[str] = None  # Mã phường/xã


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
    Recommend friends dựa trên content similarity + location matching
    
    Strategy:
    - Content similarity: Sử dụng BGE-M3 embeddings để tính độ tương đồng nội dung
      (posts, liked posts, comments)
    - Location matching: Ưu tiên users cùng vị trí địa lý (wardCode, provinceCode)
    - Weighted combination: Kết hợp cả 2 yếu tố với trọng số động:
      * Cùng wardCode + provinceCode: 60% location, 40% content
      * Cùng district: 40% location, 60% content  
      * Cùng province: 25% location, 75% content
      * Không có location match: 100% content
    
    Args:
        input_data: User ID và list users data (bao gồm province_code, district_code, ward_code)
        
    Returns:
        List of recommended users với similarity scores (0-1)
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
        target_user = user_map[input_data.user_id]
        similarities = {}
        following = user_map[input_data.user_id].following_ids

        logger.info(f"Calculating similarities for user {input_data.user_id}...")

        for uid, emb in user_embeddings.items():
            if uid != input_data.user_id and uid not in following:
                # Content similarity (0-1)
                content_sim = cosine_similarity(target_emb, emb.reshape(1, -1))[0][0]
                
                # Location matching score (0-1)
                location_score = 0.0
                candidate_user = user_map[uid]
                
                # Check location matches with higher weights for wardCode and provinceCode
                if target_user.province_code and candidate_user.province_code:
                    if target_user.province_code == candidate_user.province_code:
                        # Cùng tỉnh: base score
                        location_score = 0.3
                        
                        # Check district match (nếu cả 2 đều có districtCode)
                        if target_user.district_code and candidate_user.district_code:
                            if target_user.district_code == candidate_user.district_code:
                                # Cùng quận: tăng score
                                location_score = 0.5
                        
                        # Check wardCode match (quan trọng nhất - có thể match ngay cả khi không có districtCode)
                        if target_user.ward_code and candidate_user.ward_code:
                            if target_user.ward_code == candidate_user.ward_code:
                                # Cùng phường: score cao nhất (ưu tiên cao)
                                # Đây là match quan trọng nhất - cùng wardCode + provinceCode
                                location_score = 0.8
                                logger.info(f"📍 Found same ward+province match: {candidate_user.username} (ward: {candidate_user.ward_code}, province: {candidate_user.province_code})")
                
                # Weighted combination: 
                # - Nếu có location match tốt (cùng wardCode + provinceCode): ưu tiên location hơn
                # - Nếu không có location match: dựa vào content similarity
                if location_score >= 0.8:
                    # Cùng wardCode và provinceCode: location weight = 80%, content = 20%
                    # Tăng mạnh location weight để ưu tiên users cùng location lên top
                    # Đảm bảo combined_sim tối thiểu 0.7 để luôn được recommend
                    combined_sim = max(
                        0.7,  # Minimum score để đảm bảo được recommend
                        0.8 * location_score + 0.2 * max(content_sim, 0.1)
                    )
                elif location_score >= 0.5:
                    # Cùng district: location weight = 60%, content = 40%
                    combined_sim = 0.6 * location_score + 0.4 * max(content_sim, 0.1)
                elif location_score >= 0.3:
                    # Cùng province: location weight = 40%, content = 60%
                    combined_sim = 0.4 * location_score + 0.6 * max(content_sim, 0.1)
                else:
                    # Không có location match: chỉ dựa vào content
                    combined_sim = content_sim
                
                # Ensure score is in valid range [0, 1]
                combined_sim = max(0.0, min(1.0, combined_sim))
                
                # Lower threshold for users with strong location match
                # Nếu có location match tốt (cùng wardCode + provinceCode), giảm threshold
                threshold = 0.1
                if location_score >= 0.8:
                    # Cùng wardCode + provinceCode: giảm threshold xuống 0.05
                    threshold = 0.05
                elif location_score >= 0.5:
                    # Cùng district: threshold 0.08
                    threshold = 0.08
                elif location_score >= 0.3:
                    # Cùng province: threshold 0.09
                    threshold = 0.09
                
                if combined_sim > threshold:
                    similarities[uid] = combined_sim

        # Top N - ưu tiên users cùng location
        top = 5  # Có thể thêm param nếu cần
        
        # Sắp xếp: ưu tiên users có location match tốt trước
        def sort_key(item):
            uid, score = item
            user = user_map[uid]
            # Kiểm tra location match
            location_priority = 0
            if target_user.province_code and user.province_code:
                if target_user.province_code == user.province_code:
                    if target_user.ward_code and user.ward_code:
                        if target_user.ward_code == user.ward_code:
                            location_priority = 3  # Cùng wardCode + provinceCode: priority cao nhất
                        else:
                            location_priority = 2  # Cùng province, khác ward
                    else:
                        location_priority = 1  # Cùng province
            # Sort: location_priority cao hơn, sau đó mới đến score
            return (location_priority, score)
        
        suggested = sorted(similarities.items(), key=sort_key, reverse=True)[:top]
        
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

