(function (root, factory) {
    const visualizeAVL = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = visualizeAVL;
        module.exports.visualizeAVL = visualizeAVL;
    }

    root.visualizeAVL = visualizeAVL;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const DEFAULTS = {
        radius: 22,
        horizontalGap: 72,
        verticalGap: 80,
        padding: 30
    };

    function escapeXml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    function validateOptions(options) {
        const settings = { ...DEFAULTS, ...options };
        for (const [name, value] of Object.entries(settings)) {
            if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
                throw new TypeError(`${name} must be a positive finite number`);
            }
        }
        if (settings.horizontalGap < settings.radius * 2) {
            throw new RangeError("horizontalGap must be at least twice the radius");
        }
        if (settings.verticalGap < settings.radius * 2) {
            throw new RangeError("verticalGap must be at least twice the radius");
        }
        return settings;
    }

    function visualizeAVL(treeOrRoot, options = {}) {
        if (options === null || typeof options !== "object" || Array.isArray(options)) {
            throw new TypeError("options must be an object");
        }
        const settings = validateOptions(options);
        const root = treeOrRoot && "root" in Object(treeOrRoot)
            ? treeOrRoot.root
            : treeOrRoot;

        if (root == null) {
            const size = settings.padding * 2;
            return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Empty AVL tree"></svg>`;
        }

        const nodes = [];
        const seen = new Set();
        let maxDepth = 0;

        function visit(node, depth) {
            if (node == null) return;
            if (typeof node !== "object") {
                throw new TypeError("tree children must be node objects or null");
            }
            if (seen.has(node)) {
                throw new TypeError("tree must not contain cycles or shared nodes");
            }
            if (!("key" in node)) {
                throw new TypeError("each tree node must have a key");
            }
            seen.add(node);
            maxDepth = Math.max(maxDepth, depth);
            visit(node.left, depth + 1);
            nodes.push({ node, depth });
            visit(node.right, depth + 1);
        }

        visit(root, 0);

        const width = Math.max(
            settings.padding * 2,
            (nodes.length - 1) * settings.horizontalGap + settings.padding * 2
        );
        const height = maxDepth * settings.verticalGap + settings.padding * 2;
        const positions = new Map();

        nodes.forEach(({ node, depth }, index) => {
            positions.set(node, {
                x: settings.padding + index * settings.horizontalGap,
                y: settings.padding + depth * settings.verticalGap
            });
        });

        const edges = [];
        const circles = [];
        const labels = [];

        for (const { node } of nodes) {
            const position = positions.get(node);
            for (const child of [node.left, node.right]) {
                if (child) {
                    const childPosition = positions.get(child);
                    edges.push(
                        `<line data-from-key="${escapeXml(node.key)}" data-to-key="${escapeXml(child.key)}" x1="${position.x}" y1="${position.y}" x2="${childPosition.x}" y2="${childPosition.y}" stroke="#64748b" stroke-width="2"/>`
                    );
                }
            }
            circles.push(
                `<circle data-key="${escapeXml(node.key)}" cx="${position.x}" cy="${position.y}" r="${settings.radius}" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/>`
            );
            labels.push(
                `<text data-key="${escapeXml(node.key)}" x="${position.x}" y="${position.y}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="14" fill="#172554">${escapeXml(node.key)}</text>`
            );
        }

        return [
            `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="AVL tree">`,
            ...edges,
            ...circles,
            ...labels,
            "</svg>"
        ].join("");
    }

    return visualizeAVL;
});
