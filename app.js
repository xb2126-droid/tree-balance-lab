(function () {
    const MAX_VALUES = 30;
    const ROTATION_NAMES = {
        LL: "left-left (LL)",
        LR: "left-right (LR)",
        RR: "right-right (RR)",
        RL: "right-left (RL)"
    };

    const elements = {
        form: document.getElementById("sequence-form"),
        input: document.getElementById("sequence-input"),
        random: document.getElementById("random-button"),
        reset: document.getElementById("reset-button"),
        next: document.getElementById("next-button"),
        step: document.getElementById("step-button"),
        autoplay: document.getElementById("autoplay-button"),
        sequenceCount: document.getElementById("sequence-count"),
        sequenceChips: document.getElementById("sequence-chips"),
        inputMessage: document.getElementById("input-message"),
        progress: document.getElementById("progress-label"),
        predictionPanel: document.getElementById("prediction-panel"),
        predictionContext: document.getElementById("prediction-context"),
        predictionOptions: document.getElementById("prediction-options"),
        predictionFeedback: document.getElementById("prediction-feedback"),
        bstVisual: document.getElementById("bst-visual"),
        avlVisual: document.getElementById("avl-visual"),
        bstHeight: document.getElementById("bst-height"),
        bstDepth: document.getElementById("bst-depth"),
        bstComparisons: document.getElementById("bst-comparisons"),
        avlHeight: document.getElementById("avl-height"),
        avlDepth: document.getElementById("avl-depth"),
        avlComparisons: document.getElementById("avl-comparisons")
    };

    const state = {
        sequence: [],
        nextIndex: 0,
        bstRoot: null,
        avlTree: null,
        bstComparisons: 0,
        avlComparisons: 0,
        avlLastComparisons: 0,
        bstLastDepth: 0,
        avlLastDepth: 0,
        pending: null,
        autoplayTimer: null
    };
    const activeTreeAnimations = new WeakMap();
    const ROTATION_ANIMATION_MS = 820;

    function height(node) {
        return node ? 1 + Math.max(height(node.left), height(node.right)) : 0;
    }

    function findDepth(node, key, depth = 1) {
        while (node) {
            if (key === node.key) return depth;
            node = key < node.key ? node.left : node.right;
            depth += 1;
        }
        return 0;
    }

    function cloneTree(node) {
        if (!node) return null;
        return { key: node.key, left: cloneTree(node.left), right: cloneTree(node.right) };
    }

    function insertUnbalanced(node, key) {
        if (!node) return { key, left: null, right: null };
        if (key < node.key) node.left = insertUnbalanced(node.left, key);
        else node.right = insertUnbalanced(node.right, key);
        return node;
    }

    function findImbalance(node) {
        if (!node) return null;
        const left = findImbalance(node.left);
        if (left) return left;
        const right = findImbalance(node.right);
        if (right) return right;

        const leftHeight = height(node.left);
        const rightHeight = height(node.right);
        if (leftHeight - rightHeight > 1 || rightHeight - leftHeight > 1) {
            return { key: node.key, balance: leftHeight - rightHeight };
        }
        return null;
    }

    function getRotationPreview(root, key) {
        const preview = insertUnbalanced(cloneTree(root), key);
        const imbalance = findImbalance(preview);
        if (!imbalance) return null;

        const pivot = findNode(preview, imbalance.key);
        const isLeftHeavy = imbalance.balance > 1;
        const type = isLeftHeavy
            ? (key < pivot.left.key ? "LL" : "LR")
            : (key > pivot.right.key ? "RR" : "RL");
        const stages = [cloneTree(preview)];

        if (type === "LR" || type === "RL") {
            const intermediate = cloneTree(preview);
            rotateAt(intermediate, imbalance.key, type === "LR" ? "left" : "right", true);
            stages.push(intermediate);
        }

        return { type, pivotKey: imbalance.key, preview, stages };
    }

    function findNode(node, key) {
        while (node) {
            if (node.key === key) return node;
            node = key < node.key ? node.left : node.right;
        }
        return null;
    }

    function rotateLeft(node) {
        const pivot = node.right;
        node.right = pivot.left;
        pivot.left = node;
        return pivot;
    }

    function rotateRight(node) {
        const pivot = node.left;
        node.left = pivot.right;
        pivot.right = node;
        return pivot;
    }

    function rotateAt(root, key, direction, childOnly = false) {
        if (!root) return root;
        if (root.key === key) {
            if (childOnly) {
                if (direction === "left") root.left = rotateLeft(root.left);
                else root.right = rotateRight(root.right);
                return root;
            }
            return direction === "left" ? rotateLeft(root) : rotateRight(root);
        }
        if (key < root.key) root.left = rotateAt(root.left, key, direction, childOnly);
        else root.right = rotateAt(root.right, key, direction, childOnly);
        return root;
    }

    function insertBST(key) {
        let comparisons = 0;
        let depth = 1;
        if (!state.bstRoot) {
            state.bstRoot = { key, left: null, right: null };
            return { comparisons, depth };
        }

        let node = state.bstRoot;
        while (true) {
            comparisons += 1;
            if (key === node.key) return { comparisons, depth };
            if (key < node.key) {
                if (!node.left) {
                    node.left = { key, left: null, right: null };
                    break;
                }
                node = node.left;
            } else {
                if (!node.right) {
                    node.right = { key, left: null, right: null };
                    break;
                }
                node = node.right;
            }
            depth += 1;
        }
        return { comparisons, depth };
    }

    function newAVLTree() {
        state.avlLastComparisons = 0;
        state.avlTree = new AVLTree((a, b) => {
            state.avlLastComparisons += 1;
            return a - b;
        });
    }

    function setSequence(sequence) {
        stopAutoplay();
        activeTreeAnimations.get(elements.bstVisual)?.();
        activeTreeAnimations.get(elements.avlVisual)?.();
        state.sequence = sequence;
        state.nextIndex = 0;
        state.bstRoot = null;
        state.bstComparisons = 0;
        state.avlComparisons = 0;
        state.bstLastDepth = 0;
        state.avlLastDepth = 0;
        state.pending = null;
        newAVLTree();
        elements.inputMessage.textContent = "";
        elements.predictionPanel.hidden = true;
        elements.predictionFeedback.textContent = "";
        elements.bstVisual.innerHTML = '<p class="empty-state">Insert a number to grow the tree.</p>';
        elements.avlVisual.innerHTML = '<p class="empty-state">The AVL tree will rebalance as needed.</p>';
        updateMetrics();
        updateSequenceDisplay();
        updateControls();
    }

    function updateSequenceDisplay() {
        elements.sequenceCount.textContent = `${state.sequence.length} ${state.sequence.length === 1 ? "value" : "values"}`;
        if (!state.sequence.length) {
            elements.sequenceChips.innerHTML = '<span class="muted-copy">Your sequence will appear here.</span>';
            return;
        }
        elements.sequenceChips.innerHTML = state.sequence.map((value, index) => {
            const status = index < state.nextIndex ? "is-done" : index === state.nextIndex ? "is-next" : "";
            return `<span class="sequence-chip ${status}">${value}</span>`;
        }).join("");
    }

    function updateControls() {
        const waitingForPrediction = state.pending && !state.pending.predicted;
        const showingRotation = state.pending && state.pending.predicted;
        elements.next.disabled = state.sequence.length === 0
            || state.nextIndex >= state.sequence.length
            || Boolean(waitingForPrediction);
        elements.step.disabled = !showingRotation || state.pending.animating;
        elements.autoplay.disabled = !showingRotation || state.pending.animating;
        elements.next.innerHTML = 'Insert next value <span aria-hidden="true">→</span>';
        elements.progress.textContent = state.pending
            ? (waitingForPrediction ? `Predict the rotation for ${state.pending.key}` : state.pending.stageLabel)
            : state.sequence.length
                ? `${state.nextIndex} of ${state.sequence.length} values inserted`
                : "Ready to begin";
    }

    function renderTree(container, tree, animate = false, onComplete) {
        activeTreeAnimations.get(container)?.();
        if (window.renderAVLTree3D?.(container, tree, animate, onComplete)) return;
        if (!tree) {
            container.innerHTML = '<p class="empty-state">Insert a number to grow the tree.</p>';
            return;
        }
        const markup = visualizeAVL(tree);
        const currentSvg = container.querySelector("svg");
        if (!animate || !currentSvg || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            container.innerHTML = markup;
            onComplete?.();
            return;
        }

        const targetSvg = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
        const targetChildren = Array.from(targetSvg.children);
        const oldChildren = Array.from(currentSvg.children);
        const oldByEdge = new Map();
        const oldByTagAndKey = new Map();
        const numberAttributes = {
            line: ["x1", "y1", "x2", "y2"],
            circle: ["cx", "cy", "r"],
            text: ["x", "y"]
        };
        const animations = [];
        const retained = new Set();
        const removedEdges = [];
        const animatedNodes = new Set();
        const nodeArcs = new Map();

        for (const child of oldChildren) {
            if (child.tagName === "line") {
                oldByEdge.set(`${child.getAttribute("data-from-key")}\u0000${child.getAttribute("data-to-key")}`, child);
            } else if (child.hasAttribute("data-key")) {
                oldByTagAndKey.set(`${child.tagName}\u0000${child.getAttribute("data-key")}`, child);
            }
        }

        for (const target of targetChildren) {
            if (target.tagName !== "circle") continue;
            const key = target.getAttribute("data-key");
            const current = oldByTagAndKey.get(`circle\u0000${key}`);
            if (!current) continue;
            const dx = Number(target.getAttribute("cx")) - Number(current.getAttribute("cx"));
            const dy = Number(target.getAttribute("cy")) - Number(current.getAttribute("cy"));
            if (dx !== 0 || dy !== 0) {
                nodeArcs.set(key, Math.min(18, Math.max(10, Math.hypot(dx, dy) * 0.1)));
            }
        }

        for (const target of targetChildren) {
            let existing;
            if (target.tagName === "line") {
                const edgeKey = `${target.getAttribute("data-from-key")}\u0000${target.getAttribute("data-to-key")}`;
                existing = oldByEdge.get(edgeKey);
                if (existing) {
                    retained.add(existing);
                    animateAttributes(existing, target, numberAttributes.line, animations, animatedNodes, {
                        fromArc: nodeArcs.get(target.getAttribute("data-from-key")) || 0,
                        toArc: nodeArcs.get(target.getAttribute("data-to-key")) || 0
                    });
                } else {
                    existing = target.cloneNode(true);
                    existing.setAttribute("opacity", "0");
                    animations.push({ element: existing, from: { opacity: 0 }, to: { opacity: 1 } });
                }
            } else {
                const key = target.getAttribute("data-key");
                existing = oldByTagAndKey.get(`${target.tagName}\u0000${key}`);
                if (existing) {
                    retained.add(existing);
                    animateAttributes(existing, target, numberAttributes[target.tagName], animations, animatedNodes, {
                        arc: nodeArcs.get(key) || 0,
                        pulse: target.tagName === "circle" && nodeArcs.has(key)
                    });
                } else {
                    existing = target.cloneNode(true);
                    const targetAttributes = numberAttributes[target.tagName];
                    if (target.tagName === "circle") existing.setAttribute("r", "0");
                    existing.setAttribute("opacity", "0");
                    animations.push({
                        element: existing,
                        from: Object.fromEntries(targetAttributes.map((name) => [name, Number(existing.getAttribute(name) || 0)]).concat([["opacity", 0]])),
                        to: Object.fromEntries(targetAttributes.map((name) => [name, Number(target.getAttribute(name) || 0)]).concat([["opacity", 1]]))
                    });
                }
            }
            currentSvg.appendChild(existing);
        }

        for (const child of oldChildren) {
            if (!retained.has(child) && child.tagName === "line") {
                removedEdges.push(child);
                animations.push({
                    element: child,
                    from: { opacity: Number(child.getAttribute("opacity") || 1) },
                    to: { opacity: 0 }
                });
            } else if (!retained.has(child) && child.tagName !== "line") {
                child.remove();
            }
        }

        const start = performance.now();
        let frameId;
        let cancelled = false;
        const cancel = () => {
            cancelled = true;
            cancelAnimationFrame(frameId);
            animatedNodes.forEach((node) => node.classList.remove("rotation-moving-node"));
            if (activeTreeAnimations.get(container) === cancel) activeTreeAnimations.delete(container);
        };
        activeTreeAnimations.set(container, cancel);

        function tick(now) {
            if (cancelled) return;
            const progress = Math.min(1, (now - start) / ROTATION_ANIMATION_MS);
            const eased = 1 - (1 - progress) ** 3;
            for (const animation of animations) {
                for (const [attribute, fromValue] of Object.entries(animation.from)) {
                    const toValue = animation.to[attribute];
                    let value = fromValue + (toValue - fromValue) * eased;
                    if (animation.arc && (attribute === "y" || attribute === "cy")) {
                        value -= Math.sin(Math.PI * progress) * animation.arc;
                    } else if (animation.pulse && attribute === "r") {
                        value += Math.sin(Math.PI * progress) * 2.8;
                    } else if (attribute === "y1" && animation.fromArc) {
                        value -= Math.sin(Math.PI * progress) * animation.fromArc;
                    } else if (attribute === "y2" && animation.toArc) {
                        value -= Math.sin(Math.PI * progress) * animation.toArc;
                    }
                    animation.element.setAttribute(attribute, String(value));
                }
            }

            if (progress < 1) {
                frameId = requestAnimationFrame(tick);
                return;
            }
            for (const attribute of ["width", "height", "viewBox"]) {
                currentSvg.setAttribute(attribute, targetSvg.getAttribute(attribute));
            }
            animatedNodes.forEach((node) => node.classList.remove("rotation-moving-node"));
            removedEdges.forEach((edge) => edge.remove());
            if (activeTreeAnimations.get(container) === cancel) activeTreeAnimations.delete(container);
            onComplete?.();
        }

        frameId = requestAnimationFrame(tick);
    }

    function animateAttributes(element, target, attributes, animations, animatedNodes, effects = {}) {
        const from = {};
        const to = {};
        for (const attribute of attributes) {
            from[attribute] = Number(element.getAttribute(attribute));
            to[attribute] = Number(target.getAttribute(attribute));
            element.setAttribute(attribute, target.getAttribute(attribute));
        }
        for (const attribute of Array.from(target.attributes)) {
            if (!attributes.includes(attribute.name)) {
                element.setAttribute(attribute.name, attribute.value);
            }
        }
        if (element.tagName === "circle" && effects.pulse) {
            element.classList.remove("rotation-moving-node");
            element.classList.add("rotation-moving-node");
            animatedNodes.add(element);
        }
        animations.push({ element, from, to, ...effects });
    }

    function updateMetrics() {
        elements.bstHeight.textContent = state.bstRoot ? height(state.bstRoot) : "—";
        elements.bstDepth.textContent = state.bstLastDepth || "—";
        elements.bstComparisons.textContent = state.bstLastDepth
            ? `${state.bstComparisons} total`
            : "—";
        elements.avlHeight.textContent = state.avlTree.root ? height(state.avlTree.root) : "—";
        elements.avlDepth.textContent = state.avlLastDepth || "—";
        elements.avlComparisons.textContent = state.avlLastDepth
            ? `${state.avlComparisons} total`
            : "—";
    }

    function refreshTrees(avlDisplayRoot = state.avlTree.root) {
        renderTree(elements.bstVisual, state.bstRoot);
        renderTree(elements.avlVisual, avlDisplayRoot);
        updateMetrics();
    }

    function insertNext() {
        if (state.pending && !state.pending.predicted) return;
        if (state.pending) {
            stopAutoplay();
            completeRotation();
        }
        if (state.nextIndex >= state.sequence.length) return;
        const key = state.sequence[state.nextIndex];
        const preview = getRotationPreview(state.avlTree.root, key);
        const bstResult = insertBST(key);
        state.bstComparisons += bstResult.comparisons;
        state.bstLastDepth = bstResult.depth;
        state.nextIndex += 1;
        updateSequenceDisplay();

        if (!preview) {
            state.avlLastComparisons = 0;
            state.avlTree.insert(key);
            state.avlComparisons += state.avlLastComparisons;
            state.avlLastDepth = findDepth(state.avlTree.root, key);
            refreshTrees();
            updateControls();
            return;
        }

        state.pending = {
            ...preview,
            key,
            predicted: false,
            attempts: 0,
            stageIndex: -1,
            stageLabel: "Rotation ready"
        };
        elements.predictionPanel.hidden = false;
        elements.predictionFeedback.textContent = "";
        elements.predictionContext.textContent =
            `Value ${key} was added to the BST. The AVL preview is unbalanced at ${preview.pivotKey}. Which move should happen next?`;
        setPredictionChoicesEnabled(true);
        refreshTrees(preview.preview);
        updateControls();
        elements.predictionOptions.querySelector("button")?.focus();
    }

    function setPredictionChoicesEnabled(enabled) {
        elements.predictionOptions.querySelectorAll("button").forEach((button) => {
            button.disabled = !enabled;
        });
    }

    function answerPrediction(guess) {
        if (!state.pending || state.pending.predicted) return;
        const pending = state.pending;
        pending.attempts += 1;
        const isCorrect = guess === pending.type;
        if (!isCorrect && pending.attempts === 1) {
            elements.predictionFeedback.textContent = "Not quite. Take another look and try one more time.";
            elements.predictionFeedback.style.color = "#a64b37";
            return;
        }

        elements.predictionFeedback.textContent = isCorrect
            ? `Correct — ${ROTATION_NAMES[pending.type]} is needed. Step through the ${pending.type} rotation below.`
            : `Not quite. The correct option is ${ROTATION_NAMES[pending.type]}. Step through the ${pending.type} rotation below.`;
        elements.predictionFeedback.style.color = isCorrect ? "#13745e" : "#a64b37";
        elements.predictionContext.textContent =
            `The first unbalanced node is ${pending.pivotKey}. Follow the tree as AVL performs the ${pending.type} rotation.`;
        setPredictionChoicesEnabled(false);

        state.avlLastComparisons = 0;
        state.avlTree.insert(pending.key);
        state.avlComparisons += state.avlLastComparisons;
        state.avlLastDepth = findDepth(state.avlTree.root, pending.key);
        pending.stages.push(cloneTree(state.avlTree.root));
        pending.stageIndex = 0;
        pending.animating = false;
        pending.stageLabel = pending.type.length === 2 && pending.type[0] !== pending.type[1]
            ? `${pending.type} · Unbalanced tree (${pending.stageIndex + 1} of ${pending.stages.length + 1})`
            : `${pending.type} · Unbalanced tree`;
        pending.predicted = true;
        renderTree(elements.avlVisual, pending.stages[0]);
        updateMetricsForDisplayedStage(pending.stages[0]);
        updateControls();
        stepRotation();
    }

    function updateMetricsForDisplayedStage(tree) {
        elements.bstHeight.textContent = state.bstRoot ? height(state.bstRoot) : "—";
        elements.bstDepth.textContent = state.bstLastDepth || "—";
        elements.bstComparisons.textContent = state.bstLastDepth ? `${state.bstComparisons} total` : "—";
        elements.avlHeight.textContent = tree ? height(tree) : "—";
        elements.avlDepth.textContent = state.avlLastDepth || "—";
        elements.avlComparisons.textContent = `${state.avlComparisons} total`;
    }

    function stepRotation() {
        const pending = state.pending;
        if (!pending || !pending.predicted) return;
        const finalStageIndex = pending.stages.length - 1;
        if (pending.stageIndex < finalStageIndex) {
            pending.stageIndex += 1;
            const isFinal = pending.stageIndex === finalStageIndex;
            const isIntermediate = pending.type === "LR" || pending.type === "RL";
            pending.stageLabel = isFinal
                ? `${pending.type} · Balanced tree`
                : `${pending.type} · First rotation (${pending.stageIndex} of 2)`;
            pending.animating = true;
            updateMetricsForDisplayedStage(pending.stages[pending.stageIndex]);
            updateControls();
            renderTree(elements.avlVisual, pending.stages[pending.stageIndex], true, () => {
                if (state.pending !== pending) return;
                pending.animating = false;
                updateControls();
                if (isFinal || !isIntermediate) completeRotation();
            });
            return;
        }
        completeRotation();
    }

    function completeRotation() {
        if (!state.pending) return;
        const key = state.pending.key;
        renderTree(elements.avlVisual, state.avlTree.root);
        state.avlLastDepth = findDepth(state.avlTree.root, key);
        state.pending = null;
        elements.predictionPanel.hidden = true;
        elements.predictionFeedback.textContent = "";
        refreshTrees();
        updateControls();
        if (state.nextIndex >= state.sequence.length) {
            elements.progress.textContent = `Complete · ${state.sequence.length} values inserted`;
        }
    }

    function startAutoplay() {
        if (!state.pending || !state.pending.predicted || state.autoplayTimer) return;
        elements.autoplay.textContent = "Pause";
        state.autoplayTimer = window.setInterval(() => {
            if (!state.pending) {
                stopAutoplay();
                return;
            }
            stepRotation();
            if (!state.pending) stopAutoplay();
        }, 950);
    }

    function stopAutoplay() {
        if (state.autoplayTimer) {
            window.clearInterval(state.autoplayTimer);
            state.autoplayTimer = null;
        }
        elements.autoplay.textContent = "Auto-play";
    }

    function parseSequence(text) {
        const tokens = text.trim().split(/[\s,]+/).filter(Boolean);
        if (!tokens.length) throw new Error("Enter at least one number, separated by commas or spaces.");
        if (tokens.length > MAX_VALUES) throw new Error(`Use ${MAX_VALUES} numbers or fewer so the trees stay readable.`);
        const values = tokens.map((token) => {
            const value = Number(token);
            if (!Number.isFinite(value)) throw new Error(`"${token}" is not a valid number.`);
            return value;
        });
        if (new Set(values).size !== values.length) {
            throw new Error("Use unique numbers; duplicate values are ignored by these trees.");
        }
        return values;
    }

    elements.form.addEventListener("submit", (event) => {
        event.preventDefault();
        try {
            const sequence = parseSequence(elements.input.value);
            setSequence(sequence);
            elements.inputMessage.style.color = "";
        } catch (error) {
            elements.inputMessage.textContent = error.message;
        }
    });

    elements.random.addEventListener("click", () => {
        const values = new Set();
        while (values.size < 10) values.add(Math.floor(Math.random() * 99) + 1);
        const sequence = Array.from(values);
        elements.input.value = sequence.join(", ");
        setSequence(sequence);
    });

    elements.reset.addEventListener("click", () => setSequence(state.sequence));
    elements.next.addEventListener("click", insertNext);
    elements.step.addEventListener("click", stepRotation);
    elements.autoplay.addEventListener("click", () => {
        if (state.autoplayTimer) stopAutoplay();
        else startAutoplay();
    });

    elements.predictionOptions.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-rotation]");
        if (button && !button.disabled) answerPrediction(button.dataset.rotation);
    });

    setSequence([]);
})();
