(function (root, factory) {
    const { AVLTree, AVLNode } = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = AVLTree;
        module.exports.AVLTree = AVLTree;
        module.exports.AVLNode = AVLNode;
    }

    root.AVLTree = AVLTree;
    root.AVLNode = AVLNode;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    class AVLNode {
        constructor(key) {
            this.key = key;
            this.left = null;
            this.right = null;
            this.height = 1;
        }
    }

    class AVLTree {
        constructor(compare = AVLTree.defaultCompare) {
            if (typeof compare !== "function") {
                throw new TypeError("compare must be a function");
            }

            this.root = null;
            this.compare = compare;
        }

        static defaultCompare(a, b) {
            if (a === b) return 0;
            if (a < b) return -1;
            if (a > b) return 1;
            return NaN;
        }

        insert(key) {
            this.root = this._insert(this.root, key);
            return this.root;
        }

        rotateLeft(node) {
            if (!(node instanceof AVLNode) || !node.right) {
                throw new TypeError("left rotation requires a node with a right child");
            }

            const pivot = node.right;
            node.right = pivot.left;
            pivot.left = node;

            this._updateHeight(node);
            this._updateHeight(pivot);
            return pivot;
        }

        rotateRight(node) {
            if (!(node instanceof AVLNode) || !node.left) {
                throw new TypeError("right rotation requires a node with a left child");
            }

            const pivot = node.left;
            node.left = pivot.right;
            pivot.right = node;

            this._updateHeight(node);
            this._updateHeight(pivot);
            return pivot;
        }

        _insert(node, key) {
            if (!node) return new AVLNode(key);

            const order = this._compare(key, node.key);
            if (order < 0) {
                node.left = this._insert(node.left, key);
            } else if (order > 0) {
                node.right = this._insert(node.right, key);
            } else {
                return node;
            }

            this._updateHeight(node);
            const balance = this._balanceFactor(node);

            if (balance > 1) {
                if (this._balanceFactor(node.left) < 0) {
                    node.left = this.rotateLeft(node.left);
                }
                return this.rotateRight(node);
            }

            if (balance < -1) {
                if (this._balanceFactor(node.right) > 0) {
                    node.right = this.rotateRight(node.right);
                }
                return this.rotateLeft(node);
            }

            return node;
        }

        _compare(a, b) {
            const result = this.compare(a, b);
            if (typeof result !== "number" || Number.isNaN(result)) {
                throw new TypeError("compare must return a number for the given keys");
            }
            return result < 0 ? -1 : result > 0 ? 1 : 0;
        }

        _height(node) {
            return node ? node.height : 0;
        }

        _balanceFactor(node) {
            return this._height(node.left) - this._height(node.right);
        }

        _updateHeight(node) {
            node.height = 1 + Math.max(this._height(node.left), this._height(node.right));
        }
    }

    return { AVLTree, AVLNode };
});
