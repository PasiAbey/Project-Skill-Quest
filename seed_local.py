import os
import json
import urllib3
from azure.cosmos import CosmosClient, PartitionKey

# Disable SSL warning messages for local self-signed dev certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Setup Local Cosmos DB Credentials
# Always use localhost for direct host-machine access (Docker internal hostname 'cosmos-db' only works inside containers)
COSMOS_URL = "https://localhost:8081"
COSMOS_KEY = "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw=="
JSON_FILE_PATH = "./seeded_chunks.json"

print("="*60)
print("  SKILLQUEST LOCAL COSMOS DB OFFLINE SEEDER  ")
print("="*60)

if not os.path.exists(JSON_FILE_PATH):
    print(f"\n[ERROR] '{JSON_FILE_PATH}' was not found in the root folder.")
    print("Please download 'seeded_chunks.json' from Colab and place it in this directory.")
    exit(1)

# Connect to Local Cosmos DB Emulator Container
verify = False  # Bypassing SSL check for local containers
print(f"\nConnecting to Cosmos DB Emulator at: {COSMOS_URL}...")
try:
    client = CosmosClient(COSMOS_URL, credential=COSMOS_KEY, connection_verify=verify)
    
    # Initialize DB and Container
    database = client.create_database_if_not_exists(id="CourseRAG_DB")
    container = database.create_container_if_not_exists(
        id="CourseMaterials",
        partition_key=PartitionKey(path="/id"),
        offer_throughput=400
    )
    print("Successfully connected and verified database & container.")
except Exception as e:
    print(f"[FATAL] Failed to connect to local Cosmos DB container: {e}")
    print("Please make sure Docker is running and 'skillquest-cosmos-db' container is active.")
    exit(1)

# Load chunks from JSON
print(f"\nReading embedded chunks from '{JSON_FILE_PATH}'...")
with open(JSON_FILE_PATH, "r", encoding="utf-8") as f:
    chunks = json.load(f)

print(f"Loaded {len(chunks)} pre-computed documents from file.")

# Check for processed files to avoid duplicate seedings
try:
    query = "SELECT DISTINCT c.source FROM c"
    existing_items = container.query_items(query=query, enable_cross_partition_query=True)
    processed_files = {item['source'] for item in existing_items if 'source' in item}
except Exception:
    processed_files = set()

if processed_files:
    print(f"Database already contains chunks from {len(processed_files)} books: {processed_files}")

# Seeding loop
print("\nUploading chunks to local container...")
total_seeded = 0

for item in chunks:
    # Skip seeding if the book was already processed previously
    if item['source'] in processed_files:
        continue
        
    try:
        container.upsert_item(item)
        total_seeded += 1
        if total_seeded % 50 == 0:
            print(f" -> Uploaded {total_seeded}/{len(chunks)} chunks...")
    except Exception as e:
        print(f" -> Failed to upload chunk {item.get('id')}: {e}")

print("\n" + "="*60)
print(f"  SUCCESS! Uploaded {total_seeded} new vector-embedded chunks.")
print("  Database is now fully grounded and ready for RAG operations!")
print("="*60)
