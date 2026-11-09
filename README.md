# Tree Balance Lab

An interactive, browser-based comparison of a Binary Search Tree (BST) and an AVL tree. Both trees receive the same number sequence so you can compare their shapes and insertion costs.

## Run locally

Open `index.html` in a browser with an internet connection. Three.js is loaded from cdnjs; no build step or package installation is required. If WebGL or the CDN is unavailable, the trees fall back to SVG.

## Features

- Enter a custom sequence of unique numbers or generate a random sequence.
- Insert values into the BST and AVL tree side by side.
- Predict LL, LR, RR, or RL rotations before the AVL tree rebalances.
- Explore the trees as interactive 3D scenes: drag to rotate and double-click to reset the view.
- Watch nodes and edges animate through each rotation step, or use auto-play.
- Compare tree height, the most recently inserted value's search depth, and total insertion comparisons.
