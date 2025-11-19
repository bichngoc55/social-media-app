"""
Test script cho AI Recommendations API
Chạy: python test_api.py
"""

import requests
import json
from typing import List, Dict

API_URL = "http://localhost:8001"


def test_health():
    """Test health endpoint"""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{API_URL}/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}\n")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Error: {e}\n")
        return False


def test_recommend_friends():
    """Test recommend friends endpoint"""
    print("🔍 Testing recommend friends endpoint...")
    
    # Sample data
    input_data = {
        "user_id": "user123",
        "users": [
            {
                "id": "user123",
                "username": "john",
                "displayName": "John Doe",
                "post_contents": ["I love coding", "Python is great", "Learning React"],
                "liked_post_contents": ["React is awesome", "JavaScript tips"],
                "comment_contents": ["Nice post!", "Great tutorial"],
                "following_ids": ["user456"]
            },
            {
                "id": "user789",
                "username": "jane",
                "displayName": "Jane Smith",
                "post_contents": ["I love coding too", "JavaScript is fun", "React hooks tutorial"],
                "liked_post_contents": ["Python tips"],
                "comment_contents": ["Thanks for sharing"],
                "following_ids": []
            },
            {
                "id": "user999",
                "username": "bob",
                "displayName": "Bob Wilson",
                "post_contents": ["Traveling to Japan", "Food photography"],
                "liked_post_contents": [],
                "comment_contents": [],
                "following_ids": []
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{API_URL}/recommend-friends/",
            json=input_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Recommendations:")
            for rec in result:
                print(f"  - {rec['displayName']} (@{rec['username']}): {rec['similarity']:.4f}")
        else:
            print(f"❌ Error: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print()


def test_recommend_similar_posts():
    """Test recommend similar posts endpoint"""
    print("🔍 Testing recommend similar posts endpoint...")
    
    # Sample data
    input_data = {
        "post_id": "post123",
        "posts": [
            {
                "id": "post123",
                "content": "I love Python programming. It's so versatile and powerful!",
                "userId": "user123",
                "comment_contents": ["Me too!", "Python is great", "Best language"]
            },
            {
                "id": "post456",
                "content": "JavaScript is awesome for web development",
                "userId": "user789",
                "comment_contents": ["Agreed!", "JS is powerful"]
            },
            {
                "id": "post789",
                "content": "Python tips: use list comprehensions for cleaner code",
                "userId": "user999",
                "comment_contents": ["Great tip!", "Thanks for sharing"]
            },
            {
                "id": "post999",
                "content": "Traveling to Japan next month, so excited!",
                "userId": "user456",
                "comment_contents": ["Have fun!", "Take lots of photos"]
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{API_URL}/recommend-similar-posts/",
            json=input_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Similar Posts:")
            for post in result:
                print(f"  - Post {post['id']}: {post['content'][:50]}...")
                print(f"    Similarity: {post['similarity']:.4f}")
        else:
            print(f"❌ Error: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print()


if __name__ == "__main__":
    print("=" * 60)
    print("🧪 Testing AI Recommendations API")
    print("=" * 60)
    print()
    
    # Test health
    if not test_health():
        print("❌ Health check failed. Is the server running?")
        print("   Run: uvicorn main:app --reload --port 8001")
        exit(1)
    
    # Test recommend friends
    test_recommend_friends()
    
    # Test recommend similar posts
    test_recommend_similar_posts()
    
    print("=" * 60)
    print("✅ Tests completed!")
    print("=" * 60)

