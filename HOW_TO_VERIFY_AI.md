# 🔍 Cách kiểm tra AI Recommendations có hoạt động không

## ✅ Kết quả hiện tại

Từ hình ảnh, bạn đang thấy:

- ✅ **"Who to follow"** hiển thị 5 users (Casey Parker, Scout Green, Cameron Parker, Quinn White, River Wilson)
- ✅ Mỗi user có nút "Follow"
- ⚠️ **"Trending topics"** đang trống (có thể chưa có hashtags trong database)

---

## 🔍 Cách xác nhận AI đang hoạt động

### 1. **Kiểm tra Next.js Server Logs**

Mở terminal chạy Next.js và tìm:

**✅ Nếu AI đang hoạt động:**

```
✅ AI recommendations: 5 users (similarities: 0.85, 0.72, 0.68, 0.65, 0.61)
```

**⚠️ Nếu đang dùng fallback:**

```
⚠️ AI recommendations failed, using fallback: [error message]
```

### 2. **Kiểm tra Python API Logs**

Mở terminal chạy Python API (`uvicorn`) và tìm:

**✅ Nếu AI đang hoạt động:**

```
INFO:main:Received recommend-friends request for user: [userId]
INFO:main:Total candidate users: [number]
INFO:main:Recommended [X] friends for user [userId]
```

### 3. **Test trực tiếp Python API**

```powershell
# Test health
curl http://localhost:8001/health

# Test recommend (cần data thật)
# Hoặc chạy test script
cd python-api
.\venv\Scripts\Activate.ps1
python test_api.py
```

---

## 🎯 Phân biệt AI vs Fallback

### **AI Recommendations (Hugging Face BGE-M3)**

- ✅ Users được sắp xếp theo **similarity score** (từ cao xuống thấp)
- ✅ Dựa trên **content similarity** (posts, likes, comments)
- ✅ Có log: `✅ AI recommendations: X users (similarities: ...)`

### **Fallback (Simple Query)**

- ⚠️ Users được sắp xếp theo **createdAt** (user mới nhất)
- ⚠️ Không dựa trên AI
- ⚠️ Có log: `⚠️ AI recommendations failed, using fallback`

---

## 🔧 Nếu đang dùng Fallback

### Nguyên nhân có thể:

1. **Python API không chạy**
   - Giải pháp: Start Python API server

   ```powershell
   cd python-api
   .\venv\Scripts\Activate.ps1
   uvicorn main:app --reload --port 8001
   ```

2. **Python API timeout (>30s)**
   - Giải pháp: Đợi model load xong (lần đầu ~10-30s)

3. **Lỗi kết nối**
   - Giải pháp: Kiểm tra `PYTHON_API_URL` trong `.env.local`

---

## 📊 Trending Topics trống

**"Trending topics" đang trống** có thể do:

1. Chưa có posts với hashtags trong database
2. Hashtags chưa đủ để tạo trending list

**Để test trending topics:**

- Tạo posts với hashtags (ví dụ: `#coding #python #react`)
- Đợi cache refresh (3 giờ) hoặc restart server

---

## ✅ Kết luận

**Kết quả hiện tại:**

- ✅ UI đang hiển thị đúng
- ✅ "Who to follow" có 5 users
- ⚠️ Cần check logs để xác nhận AI hay fallback
- ⚠️ "Trending topics" cần có data hashtags

**Để xác nhận 100%:**

1. Check Next.js server logs
2. Check Python API logs
3. Verify Python API đang chạy: `http://localhost:8001/health`
