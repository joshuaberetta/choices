#!/usr/bin/env python3
import requests
import json

base_url = 'http://localhost:8000'

print("=" * 60)
print("TESTING REST FRAMEWORK ENDPOINTS")
print("=" * 60)

# Test: List choice lists
print("\n1. GET /api/choice-lists/")
r = requests.get(f'{base_url}/api/choice-lists/')
print(f"Status: {r.status_code}")
print(f"Data: {json.dumps(r.json(), indent=2)}")

# Test: Get single choice list
print("\n2. GET /api/choice-lists/1/")
r = requests.get(f'{base_url}/api/choice-lists/1/')
print(f"Status: {r.status_code}")
print(f"Data: {json.dumps(r.json(), indent=2)}")

# Test: Create a choice
print("\n3. POST /api/choice-lists/1/choices/ (add choice via API)")
r = requests.post(f'{base_url}/api/choice-lists/1/choices/', json={
    'label': 'Apple',
    'order': 0
})
print(f"Status: {r.status_code}")
print(f"Data: {json.dumps(r.json(), indent=2)}")

# Test: List projects
print("\n4. GET /api/projects/")
r = requests.get(f'{base_url}/api/projects/')
print(f"Status: {r.status_code}")
print(f"Data: {json.dumps(r.json(), indent=2)}")

print("\n" + "=" * 60)
print("TESTING KOBO ENDPOINTS")
print("=" * 60)

# Test: CSV Export
print("\n1. GET /api/aQQv2xc99EodN8pB8GZ6Jq/fruits.csv")
r = requests.get(f'{base_url}/api/aQQv2xc99EodN8pB8GZ6Jq/fruits.csv')
print(f"Status: {r.status_code}")
print(f"Content-Type: {r.headers.get('Content-Type')}")
print(f"Data:\n{r.text}")

# Test: Add Choice
print("\n2. POST /api/aQQv2xc99EodN8pB8GZ6Jq/fruits/add")
r = requests.post(f'{base_url}/api/aQQv2xc99EodN8pB8GZ6Jq/fruits/add', json={'name': 'Banana'})
print(f"Status: {r.status_code}")
print(f"Data: {json.dumps(r.json(), indent=2)}")

# Test: Remove Choice
print("\n3. POST /api/aQQv2xc99EodN8pB8GZ6Jq/fruits/remove")
r = requests.post(f'{base_url}/api/aQQv2xc99EodN8pB8GZ6Jq/fruits/remove', json={'name': 'Apple'})
print(f"Status: {r.status_code}")
print(f"Data: {json.dumps(r.json(), indent=2)}")

# Verify CSV was updated
print("\n4. GET /api/aQQv2xc99EodN8pB8GZ6Jq/fruits.csv (after changes)")
r = requests.get(f'{base_url}/api/aQQv2xc99EodN8pB8GZ6Jq/fruits.csv')
print(f"Status: {r.status_code}")
print(f"Data:\n{r.text}")
