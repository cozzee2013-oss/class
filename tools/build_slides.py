"""python3 tools/build_slides.py — slides/*.html 생성"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from slidekit import render
import decks_a, decks_b

DECKS = [decks_a.D1, decks_a.D2, decks_a.D3, decks_a.D4, decks_b.D5, decks_b.D6, decks_b.D7, decks_b.D8, decks_b.D9]
root = os.path.join(os.path.dirname(__file__), "..", "slides")
os.makedirs(root, exist_ok=True)
for d in DECKS:
    with open(os.path.join(root, d["file"]), "w", encoding="utf-8") as f:
        f.write(render(d))
    print(d["file"], len(d["slides"]), "slides")
