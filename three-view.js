(function () {
    const THREE = window.THREE;
    if (!THREE) {
        console.warn("Three.js could not be loaded. Falling back to the SVG tree renderer.");
        return;
    }

    const contexts = new WeakMap();
    const MOVE_DURATION = 720;
    const NODE_SPACING = 1.2;
    const LEVEL_SPACING = 1.05;
    const UP = new THREE.Vector3(0, 1, 0);
    const DARK_BLUE = new THREE.Color("#315ee8");
    const GREEN = new THREE.Color("#16856d");

    function collectLayout(root) {
        const nodes = [];
        const edges = [];
        let maxDepth = 0;

        function visit(node, depth, parent) {
            if (!node) return;
            maxDepth = Math.max(maxDepth, depth);
            if (parent) edges.push({ from: parent, to: node });
            visit(node.left, depth + 1, node);
            nodes.push({ node, depth });
            visit(node.right, depth + 1, node);
        }

        visit(root, 0, null);
        return {
            nodes: nodes.map(({ node, depth }, index) => ({
                key: String(node.key),
                x: (index - (nodes.length - 1) / 2) * NODE_SPACING,
                y: (maxDepth / 2 - depth) * LEVEL_SPACING,
                z: 0
            })),
            edges: edges.map(({ from, to }) => ({
                from: String(from.key),
                to: String(to.key)
            })),
            maxDepth
        };
    }

    function createLabel(key) {
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 80;
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#ffffff";
        context.font = "700 38px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(key, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.82, 0.41, 1);
        sprite.position.z = 0.36;
        sprite.userData.texture = texture;
        return sprite;
    }

    function createContext(container) {
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        } catch (error) {
            console.warn("WebGL is unavailable. Falling back to the SVG tree renderer.", error);
            return null;
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.className = "tree-canvas";
        renderer.domElement.setAttribute("role", "img");
        renderer.domElement.setAttribute("aria-label", "Interactive 3D tree visualization");
        renderer.domElement.tabIndex = 0;

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-4, 4, 2, -2, 0.1, 100);
        camera.position.set(0, 0, 24);
        camera.lookAt(0, 0, 0);

        scene.add(new THREE.AmbientLight("#ffffff", 2.2));
        const keyLight = new THREE.DirectionalLight("#ffffff", 2.8);
        keyLight.position.set(-5, 8, 12);
        scene.add(keyLight);

        const group = new THREE.Group();
        scene.add(group);

        const context = {
            container,
            renderer,
            scene,
            camera,
            group,
            nodes: new Map(),
            edges: new Map(),
            animationFrame: 0,
            resizeObserver: null,
            pointer: null,
            width: 0,
            height: 0
        };

        if (typeof ResizeObserver === "function") {
            context.resizeObserver = new ResizeObserver(() => resize(context));
            context.resizeObserver.observe(container);
        } else {
            window.addEventListener("resize", () => resize(context));
        }

        renderer.domElement.addEventListener("pointerdown", (event) => {
            context.pointer = { x: event.clientX, y: event.clientY };
            renderer.domElement.setPointerCapture(event.pointerId);
            renderer.domElement.classList.add("is-dragging");
        });
        renderer.domElement.addEventListener("pointermove", (event) => {
            if (!context.pointer) return;
            const dx = event.clientX - context.pointer.x;
            const dy = event.clientY - context.pointer.y;
            context.pointer = { x: event.clientX, y: event.clientY };
            group.rotation.y += dx * 0.008;
            group.rotation.x = THREE.MathUtils.clamp(group.rotation.x + dy * 0.006, -0.75, 0.75);
            renderer.render(scene, camera);
        });
        const endDrag = () => {
            context.pointer = null;
            renderer.domElement.classList.remove("is-dragging");
        };
        renderer.domElement.addEventListener("pointerup", endDrag);
        renderer.domElement.addEventListener("pointercancel", endDrag);
        renderer.domElement.addEventListener("dblclick", () => {
            group.rotation.set(0, 0, 0);
            renderer.render(scene, camera);
        });

        container.replaceChildren(renderer.domElement);
        resize(context);
        contexts.set(container, context);
        return context;
    }

    function resize(context, nodeCount = context.nodeCount || 1, depth = context.maxDepth || 1) {
        const width = Math.max(260, context.container.clientWidth - 40, nodeCount * 82 + 48);
        const height = Math.max(220, (depth + 1) * 74 + 44);
        context.nodeCount = nodeCount;
        context.maxDepth = depth;
        if (width === context.width && height === context.height) return;

        context.width = width;
        context.height = height;
        context.renderer.setSize(width, height, false);
        context.renderer.domElement.style.width = `${width}px`;
        context.renderer.domElement.style.height = `${height}px`;
        const halfWidth = width / 74 / 2;
        const halfHeight = height / 74 / 2;
        context.camera.left = -halfWidth;
        context.camera.right = halfWidth;
        context.camera.top = halfHeight;
        context.camera.bottom = -halfHeight;
        context.camera.updateProjectionMatrix();
        context.renderer.render(context.scene, context.camera);
    }

    function createNode(context, key, color) {
        const material = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.32,
            metalness: 0.06,
            emissive: color,
            emissiveIntensity: 0.12
        });
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 24), material);
        sphere.castShadow = true;
        sphere.userData.key = key;
        const label = createLabel(key);
        sphere.add(label);
        context.group.add(sphere);
        return sphere;
    }

    function createEdge(context, key) {
        const material = new THREE.MeshStandardMaterial({
            color: "#8090aa",
            roughness: 0.62,
            transparent: true,
            opacity: 1
        });
        const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 10), material);
        edge.userData.key = key;
        context.group.add(edge);
        return edge;
    }

    function setEdgeGeometry(edge, from, to) {
        const start = new THREE.Vector3(from.x, from.y, from.z);
        const end = new THREE.Vector3(to.x, to.y, to.z);
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        edge.userData.from = start.clone();
        edge.userData.to = end.clone();
        edge.position.copy(start).add(end).multiplyScalar(0.5);
        edge.scale.y = length;
        if (length > 0) edge.quaternion.setFromUnitVectors(UP, direction.normalize());
    }

    function disposeNode(context, node) {
        context.group.remove(node);
        node.geometry.dispose();
        node.material.dispose();
        node.children.forEach((label) => {
            label.material.map.dispose();
            label.material.dispose();
        });
    }

    function disposeEdge(context, edge) {
        context.group.remove(edge);
        edge.geometry.dispose();
        edge.material.dispose();
    }

    function renderTree3D(container, tree, animate = false, onComplete) {
        let context = contexts.get(container);
        if (!context) {
            context = createContext(container);
            if (!context) return false;
        }
        if (context.animationFrame) {
            cancelAnimationFrame(context.animationFrame);
            context.animationFrame = 0;
        }
        if (context.renderer.domElement.parentElement !== container) {
            container.replaceChildren(context.renderer.domElement);
        }

        if (!tree) {
            context.nodes.forEach((node) => disposeNode(context, node));
            context.edges.forEach((edge) => disposeEdge(context, edge));
            context.nodes.clear();
            context.edges.clear();
            rendererRender(context);
            onComplete?.();
            return true;
        }

        const layout = collectLayout(tree);
        resize(context, layout.nodes.length, layout.maxDepth);
        const color = container.closest(".avl-card") ? GREEN : DARK_BLUE;
        const targetNodes = new Map(layout.nodes.map((node) => [node.key, node]));
        const targetEdges = new Map(layout.edges.map((edge) => [`${edge.from}\u0000${edge.to}`, edge]));
        const motions = [];

        for (const [key, position] of targetNodes) {
            let mesh = context.nodes.get(key);
            const isNew = !mesh;
            if (!mesh) {
                mesh = createNode(context, key, color);
                mesh.position.set(position.x, position.y - 0.32, position.z);
                mesh.scale.setScalar(animate ? 0.01 : 1);
                context.nodes.set(key, mesh);
            }
            mesh.material.color.copy(color);
            mesh.material.emissive.copy(color);
            motions.push({
                mesh,
                from: mesh.position.clone(),
                to: new THREE.Vector3(position.x, position.y, position.z),
                fromScale: mesh.scale.x,
                toScale: 1,
                isNew
            });
        }

        const removedNodes = [];
        for (const [key, node] of context.nodes) {
            if (!targetNodes.has(key)) removedNodes.push(node);
        }

        const retainedEdges = new Set();
        for (const [key, edgeData] of targetEdges) {
            let mesh = context.edges.get(key);
            const fromNode = targetNodes.get(edgeData.from);
            const toNode = targetNodes.get(edgeData.to);
            const fromPosition = new THREE.Vector3(fromNode.x, fromNode.y, fromNode.z);
            const toPosition = new THREE.Vector3(toNode.x, toNode.y, toNode.z);
            if (!mesh) {
                mesh = createEdge(context, key);
                setEdgeGeometry(mesh, fromPosition, fromPosition);
                if (animate) mesh.material.opacity = 0;
                context.edges.set(key, mesh);
            }
            retainedEdges.add(key);
            motions.push({
                edge: mesh,
                from: mesh.userData.from.clone(),
                fromEnd: mesh.userData.to.clone(),
                to: fromPosition,
                toEnd: toPosition,
                fromOpacity: mesh.material.opacity,
                toOpacity: 1
            });
        }

        const removedEdges = [];
        for (const [key, edge] of context.edges) {
            if (!retainedEdges.has(key)) removedEdges.push(edge);
        }

        if (!animate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            motions.forEach((motion) => applyMotion(motion, 1));
            removedNodes.forEach((node) => {
                context.nodes.delete(node.userData.key);
                disposeNode(context, node);
            });
            removedEdges.forEach((edge) => {
                context.edges.delete(edge.userData.key);
                disposeEdge(context, edge);
            });
            rendererRender(context);
            onComplete?.();
            return true;
        }

        const startedAt = performance.now();
        function tick(now) {
            const progress = Math.min(1, (now - startedAt) / MOVE_DURATION);
            const eased = 1 - (1 - progress) ** 3;
            motions.forEach((motion) => applyMotion(motion, eased));
            removedNodes.forEach((node) => node.scale.setScalar(Math.max(0.01, 1 - eased)));
            removedEdges.forEach((edge) => {
                edge.material.opacity = 1 - eased;
            });
            rendererRender(context);

            if (progress < 1) {
                context.animationFrame = requestAnimationFrame(tick);
                return;
            }

            context.animationFrame = 0;
            removedNodes.forEach((node) => {
                context.nodes.delete(node.userData.key);
                disposeNode(context, node);
            });
            removedEdges.forEach((edge) => {
                context.edges.delete(edge.userData.key);
                disposeEdge(context, edge);
            });
            rendererRender(context);
            onComplete?.();
        }

        context.animationFrame = requestAnimationFrame(tick);
        return true;
    }

    function applyMotion(motion, progress) {
        if (motion.mesh) {
            motion.mesh.position.lerpVectors(motion.from, motion.to, progress);
            const scale = motion.fromScale + (motion.toScale - motion.fromScale) * progress;
            motion.mesh.scale.setScalar(scale);
            motion.mesh.material.emissiveIntensity = motion.isNew
                ? 0.12 + Math.sin(progress * Math.PI) * 0.8
                : 0.12 + Math.sin(progress * Math.PI) * 0.28;
        } else {
            const start = new THREE.Vector3().lerpVectors(motion.from, motion.to, progress);
            const end = new THREE.Vector3().lerpVectors(motion.fromEnd, motion.toEnd, progress);
            setEdgeGeometry(motion.edge, start, end);
            motion.edge.material.opacity =
                motion.fromOpacity + (motion.toOpacity - motion.fromOpacity) * progress;
        }
    }

    function rendererRender(context) {
        context.renderer.render(context.scene, context.camera);
    }

    function clearTree3D(container) {
        const context = contexts.get(container);
        if (!context) return;
        if (context.animationFrame) cancelAnimationFrame(context.animationFrame);
        context.resizeObserver?.disconnect();
        context.nodes.forEach((node) => disposeNode(context, node));
        context.edges.forEach((edge) => disposeEdge(context, edge));
        context.renderer.dispose();
        context.renderer.domElement.remove();
        contexts.delete(container);
    }

    window.renderAVLTree3D = renderTree3D;
    window.clearAVLTree3D = clearTree3D;
})();
