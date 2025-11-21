# 🤖 AI Recommendations API

FastAPI server cho AI recommendations sử dụng BGE-M3 embeddings.

## 🚀 Quick Start

### 1. Setup Environment

**Windows PowerShell:**

```powershell
cd python-api
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Windows CMD:**

```cmd
cd python-api
python -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
```

**Linux/Mac:**

```bash
cd python-api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Run Server

**Quan trọng:** Phải chạy từ thư mục `python-api`!

**Windows PowerShell:**

```powershell
cd python-api
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8001
```

**Windows CMD:**

```cmd
cd python-api
venv\Scripts\activate.bat
uvicorn main:app --reload --port 8001
```

**Linux/Mac:**

```bash
cd python-api
source venv/bin/activate
uvicorn main:app --reload --port 8001
```

Server sẽ chạy tại: http://localhost:8001

**Lưu ý:**

- Lần đầu chạy sẽ download BGE-M3 model (~1GB), cần internet
- Phải chạy từ thư mục `python-api` để import được module `main`

---

## 📋 API Endpoints

### POST `/recommend-friends/`

Recommend friends dựa trên content similarity.

**Request:**

```json
{
  "user_id": "user123",
  "users": [
    {
      "id": "user123",
      "username": "john",
      "displayName": "John Doe",
      "post_contents": ["I love coding", "Python is great"],
      "liked_post_contents": ["React is awesome"],
      "comment_contents": ["Nice post!"],
      "following_ids": ["user456"]
    },
    {
      "id": "user789",
      "username": "jane",
      "displayName": "Jane Smith",
      "post_contents": ["I love coding too", "JavaScript is fun"],
      "liked_post_contents": [],
      "comment_contents": [],
      "following_ids": []
    }
  ]
}
```

**Response:**

```json
[
  {
    "id": "user789",
    "username": "jane",
    "displayName": "Jane Smith",
    "similarity": 0.8542
  }
]
```

### POST `/recommend-similar-posts/`

Recommend similar posts dựa trên content similarity.

**Request:**

```json
{
  "post_id": "post123",
  "posts": [
    {
      "id": "post123",
      "content": "I love Python programming",
      "userId": "user123",
      "comment_contents": ["Me too!", "Python is great"]
    },
    {
      "id": "post456",
      "content": "JavaScript is awesome",
      "userId": "user789",
      "comment_contents": []
    }
  ]
}
```

**Response:**

```json
[
  {
    "id": "post456",
    "content": "JavaScript is awesome",
    "userId": "user789",
    "similarity": 0.7234
  }
]
```

### GET `/health`

Health check endpoint.

**Response:**

```json
{
  "status": "healthy",
  "model_loaded": true
}
```

---

## 🔧 How It Works

### 1. Embedding Generation

- **User Embedding**: Mean của embeddings từ:
  - User's own posts
  - Posts user đã like
  - User's comments

- **Post Embedding**: Mean của embeddings từ:
  - Post content
  - Comments on post

### 2. Similarity Calculation

- Sử dụng **cosine similarity** để tính độ tương đồng
- Threshold: 0.3 (chỉ recommend nếu similarity > 0.3)
- Top 5 recommendations

### 3. Filtering

- **Friends recommendation**: Exclude users đã follow
- **Posts recommendation**: Exclude chính post đó

---

## 📊 Integration với Next.js

### Example: Recommend Friends

```typescript
// src/lib/ai-api.ts
export async function recommendFriends(userId: string) {
  // Fetch data từ Prisma
  const userData = await fetchUserData(userId);
  const candidateUsers = await fetchCandidateUsers(userId);

  // Format data
  const users = [
    {
      id: userData.id,
      username: userData.username,
      displayName: userData.displayName,
      post_contents: userData.posts.map((p) => p.content),
      liked_post_contents: userData.likedPosts.map((p) => p.content),
      comment_contents: userData.comments.map((c) => c.content),
      following_ids: new Set(userData.following.map((f) => f.id)),
    },
    ...candidateUsers.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      post_contents: u.posts.map((p) => p.content),
      liked_post_contents: [],
      comment_contents: [],
      following_ids: new Set(),
    })),
  ];

  // Call Python API
  const response = await fetch("http://localhost:8001/recommend-friends/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, users }),
  });

  return response.json();
}
```

---

## ⚙️ Configuration

### Environment Variables

Tạo file `.env` trong thư mục `python-api`:

```env
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Optional: Chọn model (mặc định: BAAI/bge-m3)
# MODEL_NAME=BAAI/bge-small-en-v1.5  # Model nhỏ hơn (~130MB, chỉ English)
# MODEL_NAME=BAAI/bge-m3  # Model mặc định (~2.27GB, multilingual)
```

### Model

**Default Model: BGE-M3**

- **Model**: `BAAI/bge-m3`
- **Dimension**: 1024
- **Multilingual**: Yes (hỗ trợ nhiều ngôn ngữ)
- **Size**: ~2.27GB (download lần đầu)
- **Quality**: Best (chất lượng tốt nhất)

**Alternative: BGE-Small (nhẹ hơn)**

- **Model**: `BAAI/bge-small-en-v1.5`
- **Dimension**: 384
- **Multilingual**: No (chỉ English)
- **Size**: ~130MB (download lần đầu)
- **Quality**: Good (chất lượng tốt, nhanh hơn)

**Cách đổi model:**
Tạo file `.env` trong thư mục `python-api`:

```env
MODEL_NAME=BAAI/bge-small-en-v1.5  # Dùng model nhỏ hơn
# Hoặc
MODEL_NAME=BAAI/bge-m3  # Model mặc định (multilingual)
```

### Thresholds

- **Similarity threshold**: 0.3 (có thể điều chỉnh trong code)
- **Top N**: 5 (có thể điều chỉnh trong code)

---

## 🐛 Troubleshooting

### Model không load được

**Lỗi**: `OSError: Can't load tokenizer`

**Giải pháp**:

- Kiểm tra internet connection (lần đầu cần download model)
- Model sẽ được cache tại `~/.cache/huggingface/`

### Memory issues

**Lỗi**: `Out of memory`

**Giải pháp**:

- Giảm số lượng users/posts trong request
- Batch processing nếu cần

### Slow performance

**Lỗi**: API response chậm

**Giải pháp**:

- Model loading lần đầu sẽ chậm (~10-30s)
- Subsequent requests sẽ nhanh hơn
- Có thể cache embeddings nếu cần

---

## 📈 Performance

- **Model loading**: ~10-30s (lần đầu)
- **Embedding generation**: ~100-500ms per user/post
- **Similarity calculation**: ~10-50ms per comparison
- **Total API response**: ~1-3s (tùy số lượng users/posts)

---

## 🔍 Testing

### Test với curl

```bash
# Health check
curl http://localhost:8001/health

# Recommend friends
curl -X POST http://localhost:8001/recommend-friends/ \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "users": [...]
  }'
```

---

## 📝 Notes

- Model BGE-M3 là multilingual, hỗ trợ nhiều ngôn ngữ
- Embeddings được tính bằng mean pooling
- Cosine similarity range: -1 to 1 (chúng ta chỉ lấy > 0.3)
- Có thể fine-tune threshold và top N dựa trên data thực tế
