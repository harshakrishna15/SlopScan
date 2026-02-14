import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.0-flash"

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384
CONFIDENCE_THRESHOLD = 0

ACTIAN_HOST = os.getenv("ACTIAN_HOST", "localhost")
ACTIAN_PORT = os.getenv("ACTIAN_PORT", "50051")
ACTIAN_ADDRESS = f"{ACTIAN_HOST}:{ACTIAN_PORT}"
