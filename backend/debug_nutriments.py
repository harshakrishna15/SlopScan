
from datasets import load_dataset
import json

def main():
    print("Loading dataset...")
    ds = load_dataset(
        "openfoodfacts/product-database",
        split="food",
        streaming=True
    )
    
    print("Scanning first 5 products...")
    for i, row in enumerate(ds):
        if i >= 5: break
        print(f"\n--- Product {i} ---")
        print(f"Name: {row.get('product_name')}")
        nutriments = row.get('nutriments')
        print(f"Nutriments type: {type(nutriments)}")
        print(f"Nutriments val: {nutriments}")

if __name__ == "__main__":
    main()
