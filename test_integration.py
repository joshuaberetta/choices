#!/usr/bin/env python3
import requests
import json

print("\n🧪 Testing Frontend-Backend Integration")
print("=" * 60)

# 1. Check backend
print("\n1. Checking Backend (http://localhost:8000/api/choice-lists/)")
try:
    r = requests.get('http://localhost:8000/api/choice-lists/', timeout=2)
    print(f"   Status: {r.status_code} ✅")
    data = r.json()
    print(f"   Found {data['count']} choice lists")
    if data['results']:
        print(f"   First list: {data['results'][0]['name']}")
except Exception as e:
    print(f"   Error: {e} ❌")

# 2. Check frontend
print("\n2. Checking Frontend (http://localhost:5173/)")
try:
    r = requests.get('http://localhost:5173/', timeout=2)
    print(f"   Status: {r.status_code} ✅")
except Exception as e:
    print(f"   Error: {e} ❌")

# 3. Test proxy
print("\n3. Testing Vite Proxy (http://localhost:5173/api/choice-lists/)")
try:
    r = requests.get('http://localhost:5173/api/choice-lists/', timeout=2)
    print(f"   Status: {r.status_code} ✅")
    if r.status_code == 200:
        data = r.json()
        print(f"   Proxy working! Found {data['count']} choice lists")
except Exception as e:
    print(f"   Error: {e} ❌")

print("\n" + "=" * 60)
print("✨ Integration test complete!\n")
