import os
import json
import urllib3
from azure.cosmos import CosmosClient, PartitionKey
from azure.cosmos.documents import ConnectionPolicy

# Disable SSL warning messages for local self-signed dev certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Setup Cosmos DB Credentials for running INSIDE the Docker network
COSMOS_URL = "https://cosmos-db:8081"
COSMOS_KEY = "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw=="
JSON_FILE_PATH = "./seeded_chunks.json"

print("="*60)
print("  SKILLQUEST CONTAINER-SIDE COSMOS DB SEEDER  ")
print("="*60)

if not os.path.exists(JSON_FILE_PATH):
    print(f"\n[ERROR] '{JSON_FILE_PATH}' was not found.")
    exit(1)

# Connect to Cosmos DB Emulator Container
verify = False  # Bypassing SSL check for local containers
print(f"\nConnecting to Cosmos DB Emulator at: {COSMOS_URL}...")
try:
    # Disable endpoint discovery to prevent mapping to 127.0.0.1 inside Docker network
    connection_policy = ConnectionPolicy()
    connection_policy.EnableEndpointDiscovery = False

    client = CosmosClient(
        COSMOS_URL, 
        credential=COSMOS_KEY, 
        connection_verify=verify,
        connection_policy=connection_policy
    )
    
    # Initialize DB and Container
    database = client.create_database_if_not_exists(id="CourseRAG_DB")
    container = database.create_container_if_not_exists(
        id="CourseMaterials",
        partition_key=PartitionKey(path="/id"),
        offer_throughput=400
    )
    print("Successfully connected and verified database & container.")
except Exception as e:
    print(f"[FATAL] Failed to connect: {e}")
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
print("\nUploading chunks to container...")
total_seeded = 0

for item in chunks:
    # Skip seeding if the book was already processed previously
    if item['source'] in processed_files:
        continue
        
    try:
        container.upsert_item(item)
        total_seeded += 1
        if total_seeded % 100 == 0:
            print(f" -> Uploaded {total_seeded}/{len(chunks)} chunks...")
    except Exception as e:
        print(f" -> Failed to upload chunk {item.get('id')}: {e}")

print("\n" + "="*60)
print(f"  SUCCESS! Uploaded {total_seeded} new vector-embedded chunks.")
print("  Database is now fully grounded and ready for RAG operations!")
print("="*60)
