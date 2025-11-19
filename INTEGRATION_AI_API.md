# 🔗 Tích hợp Python AI API với Next.js

## ✅ Đã tích hợp

Python AI API đã được tích hợp vào Next.js với Hugging Face BGE-M3 model.

### 📋 API Routes đã tạo:

1. **`/api/ai/recommend-friends`** - Recommend friends dựa trên content similarity
2. **`/api/ai/recommend-similar-posts`** - Recommend similar posts

---

## 🚀 Setup

### 1. Start Python API Server

```powershell
cd python-api
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8001
```

### 2. Set Environment Variable (Optional)

Tạo file `.env.local` trong root project:

```env
PYTHON_API_URL=http://localhost:8001
```

Nếu không set, mặc định sẽ dùng `http://localhost:8001`.

---

## 📊 API Endpoints

### GET `/api/ai/recommend-friends`

Recommend friends dựa trên content similarity (Hugging Face BGE-M3 embeddings).

**Response:**

```json
{
  "users": [...],  // Array of User objects
  "similarities": {
    "userId1": 0.8542,
    "userId2": 0.7234
  }
}
```

**Flow:**

1. Fetch user data từ Prisma (posts, likes, comments, following)
2. Format data theo schema Prisma
3. Gửi cho Python API (BGE-M3 embeddings)
4. Nhận recommendations với similarity scores
5. Trả về full user data

### GET `/api/ai/recommend-similar-posts?postId=xxx`

Recommend similar posts dựa trên content similarity (Hugging Face BGE-M3 embeddings).

**Query Parameters:**

- `postId` (required): ID của post cần tìm similar posts

**Response:**

```json
{
  "posts": [...],  // Array of Post objects
  "similarities": {
    "postId1": 0.8542,
    "postId2": 0.7234
  }
}
```

**Flow:**

1. Fetch post data từ Prisma (content, comments)
2. Format data theo schema Prisma
3. Gửi cho Python API (BGE-M3 embeddings)
4. Nhận recommendations với similarity scores
5. Trả về full post data

---

## 🔧 Data Mapping (Prisma → Python API)

### User Data

**Prisma Schema:**

```prisma
model User {
  id        String
  username  String
  displayName String
  posts     Post[]
  likes     Like[]
  comments  Comment[]
  following Follow[]
}
```

**Python API Format:**

```typescript
{
  id: string
  username: string
  displayName: string
  post_contents: string[]        // From User.posts[].content
  liked_post_contents: string[]  // From User.likes[].post.content
  comment_contents: string[]     // From User.comments[].content
  following_ids: string[]       // From User.following[].followingId
}
```

### Post Data

**Prisma Schema:**

```prisma
model Post {
  id        String
  content   String
  userId    String
  comments  Comment[]
}
```

**Python API Format:**

```typescript
{
  id: string
  content: string
  userId: string
  comment_contents: string[]  // From Post.comments[].content
}
```

---

## 🎯 Usage Examples

### Recommend Friends (Client-side)

```typescript
const response = await fetch("/api/ai/recommend-friends");
const data = await response.json();
// data.users: Array of recommended users
// data.similarities: Map of userId -> similarity score
```

### Recommend Similar Posts (Client-side)

```typescript
const response = await fetch(
  `/api/ai/recommend-similar-posts?postId=${postId}`
);
const data = await response.json();
// data.posts: Array of similar posts
// data.similarities: Map of postId -> similarity score
```

---

## 🔄 Fallback Behavior

Nếu Python API không available hoặc có lỗi:

- Tự động fallback về simple query (lấy users/posts mới nhất)
- App vẫn hoạt động bình thường
- Logs sẽ hiển thị warning

---

## 📝 Notes

- **Hugging Face Model**: BGE-M3 (multilingual, ~2.27GB)
- **Embedding Dimension**: 1024
- **Similarity Threshold**: 0.3 (có thể điều chỉnh trong Python code)
- **Top N**: 5 recommendations
- **Performance**: ~1-3s per request (tùy số lượng data)

---

## 🐛 Troubleshooting

### Python API không chạy

**Lỗi:** `Python AI API error, using fallback`

**Giải pháp:**

1. Kiểm tra Python API server có đang chạy không: `http://localhost:8001/health`
2. Kiểm tra port 8001 có bị chiếm không
3. Kiểm tra logs của Python API

### Model không load được

**Lỗi:** `Error loading model`

**Giải pháp:**

1. Kiểm tra internet connection (lần đầu cần download model)
2. Model sẽ được cache tại `~/.cache/huggingface/`
3. Có thể dùng model nhỏ hơn: `BAAI/bge-small-en-v1.5` (~130MB)

### Timeout

**Lỗi:** Request timeout

**Giải pháp:**

1. Model loading lần đầu sẽ chậm (~10-30s)
2. Subsequent requests sẽ nhanh hơn
3. Có thể tăng timeout trong Next.js nếu cần
