// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * SceneBuilder — Three.js 씬을 선언적 config에서 자동 구성.
 *
 * viz-3d의 순수 로직 모듈 결과를 받아
 * Three.js 오브젝트(Group, Mesh, Line, Sprite)를 생성한다.
 *
 * 사용자는 이 모듈만 import하면 전체 3D 뷰가 구성됨.
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { VizConfig, CellGridDef } from "../core/types.js";
import { DEFAULT_THEME } from "../core/types.js";
import { CATEGORY_COLORS, LAYER_COLORS, PALETTE } from "../core/color-tokens.js";
import { buildGridPositions, type GridPositions } from "../core/grid-builder.js";
import { ViewEngine } from "../view/view-engine.js";
import { CellStateManager, BeamPool } from "../effects/activation.js";

// ═══════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════

export interface CellMesh {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  edgeMaterial: THREE.LineBasicMaterial;
  group: THREE.Group;
  gridDef: CellGridDef;
  catColor: { c: number; e: number };
}

export interface SceneState {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly cellMeshes: Map<string, CellMesh>;
  readonly gridGroups: Map<string, THREE.Group>;
  readonly viewEngine: ViewEngine;
  readonly cellStates: CellStateManager;
  readonly beamPool: BeamPool;
  readonly gridPositions: GridPositions;
  readonly gridFloor: THREE.GridHelper;
  readonly gridFloorSub: THREE.GridHelper;
}

export interface DisplaySettings {
  baseOpacity: number;
  glowMultiplier: number;
  edgeOpacity: number;
  gridOpacity: number;
  bgLevel: number;
  fogDensity: number;
}

// ═══════════════════════════════════════════════════
//  Scene Builder
// ═══════════════════════════════════════════════════

export function createScene(canvas: HTMLCanvasElement, config: VizConfig): SceneState {
  const theme = config.theme ?? DEFAULT_THEME;
  const cellSize = config.cellSize ?? 0.42;
  const cellGap = config.cellGap ?? 0.1;
  const layerHeights = config.layerHeights;

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.background);
  scene.fog = new THREE.FogExp2(theme.background, 0.006);

  // Camera
  const camPos = config.camera ?? { x: 40, y: 28, z: 45 };
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(camPos.x, camPos.y, camPos.z);

  // Controls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.04;
  controls.target.set(0, -2, 0);

  // Lights
  scene.add(new THREE.AmbientLight(PALETTE.bgGrid1.hex, 3));
  const dl = new THREE.DirectionalLight(0xffffff, 0.3);
  dl.position.set(20, 40, 20);
  scene.add(dl);

  // Floor grid
  const gridFloor = new THREE.GridHelper(100, 20, PALETTE.bgGrid1.hex, PALETTE.bgGrid1.hex);
  gridFloor.position.y = -14;
  gridFloor.material.transparent = true;
  gridFloor.material.opacity = 0.4;
  scene.add(gridFloor);

  const gridFloorSub = new THREE.GridHelper(100, 100, PALETTE.bgGrid2.hex, PALETTE.bgGrid2.hex);
  gridFloorSub.position.y = -14.01;
  gridFloorSub.material.transparent = true;
  gridFloorSub.material.opacity = 0.2;
  scene.add(gridFloorSub);

  // Axis guides
  const axLen = 30;
  const axMat = new THREE.LineBasicMaterial({ color: PALETTE.bgAxis.hex, transparent: true, opacity: 0.3 });
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-axLen, -14, 0), new THREE.Vector3(axLen, -14, 0)]), axMat));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -14, -axLen), new THREE.Vector3(0, -14, axLen)]), axMat.clone()));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -14, 0), new THREE.Vector3(0, 14, 0)]),
    new THREE.LineBasicMaterial({ color: PALETTE.bgAxis.hex, transparent: true, opacity: 0.15 })));

  // Ambient particles
  const ptCount = config.particleCount ?? 200;
  const ptGeo = new THREE.BufferGeometry();
  const ptPos = new Float32Array(ptCount * 3);
  for (let i = 0; i < ptCount; i++) {
    ptPos[i * 3] = (Math.random() - 0.5) * 70;
    ptPos[i * 3 + 1] = (Math.random() - 0.5) * 40;
    ptPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
  }
  ptGeo.setAttribute("position", new THREE.BufferAttribute(ptPos, 3));
  scene.add(new THREE.Points(ptGeo, new THREE.PointsMaterial({
    color: PALETTE.bgAxis.hex, size: 0.1, transparent: true, opacity: 0.5,
  })));

  // Grid positions
  const gridPositions = buildGridPositions(config.grids, layerHeights, cellSize, cellGap);

  // View engine
  const viewEngine = new ViewEngine();
  viewEngine.setPositions(gridPositions.viewPositions);

  // Cell state
  const cellStates = new CellStateManager(layerHeights.length);
  const beamPool = new BeamPool(config.maxBeams ?? 50);

  // Build grid groups
  const cellMeshes = new Map<string, CellMesh>();
  const gridGroups = new Map<string, THREE.Group>();

  for (const gridLayout of gridPositions.grids) {
    // eslint-disable-next-line typescript/no-non-null-assertion -- gridLayout.id는 config.grids에서 유래
    const def = config.grids.find(g => g.id === gridLayout.id)!;
    const catDef = CATEGORY_COLORS[def.category] ?? CATEGORY_COLORS.entity;
    const pos = gridPositions.viewPositions.layer[def.id];

    const group = new THREE.Group();
    group.position.set(pos.x, pos.y, pos.z);
    scene.add(group);
    gridGroups.set(def.id, group);

    viewEngine.registerGroup(def.id, pos);

    // Plate
    const pw = gridLayout.width + 0.4;
    const pd = gridLayout.depth + 0.4;
    const plateMat = new THREE.MeshBasicMaterial({
      color: catDef.main.hex, transparent: true, opacity: 0.02, side: THREE.DoubleSide,
    });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), plateMat);
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = -0.2;
    group.add(plate);

    // Label
    const labelTex = createTextTexture(def.id, 13, catDef.main.css);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, opacity: 0.6 }));
    label.scale.set(4, 0.7, 1);
    label.position.set(0, 0.7, -(pd / 2 + 0.4));
    group.add(label);

    // Cells
    for (const cell of gridLayout.cells) {
      const geo = new THREE.BoxGeometry(cellSize, 0.25, cellSize);
      const mat = new THREE.MeshStandardMaterial({
        color: catDef.main.hex, emissive: 0x000000,
        metalness: 0.35, roughness: 0.5, transparent: true, opacity: theme.cellOpacity,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cell.localX, 0, cell.localZ);
      group.add(mesh);

      const edgeMat = new THREE.LineBasicMaterial({ color: catDef.main.hex, transparent: true, opacity: 0.3 });
      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
      wire.position.copy(mesh.position);
      group.add(wire);

      // Entry label
      const short = cell.entry.length > 9 ? cell.entry.slice(0, 8) + "…" : cell.entry;
      const eTex = createTextTexture(short, 10, "#778");
      const eSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: eTex, transparent: true, opacity: 0.5 }));
      eSprite.scale.set(1.1, 0.22, 1);
      eSprite.position.set(cell.localX, -0.3, cell.localZ + 0.4);
      group.add(eSprite);

      cellMeshes.set(cell.key, {
        mesh, material: mat, edgeMaterial: edgeMat,
        group, gridDef: def,
        catColor: { c: catDef.main.hex, e: catDef.emissive.hex },
      });
    }
  }

  // Layer labels
  for (let i = 0; i < layerHeights.length; i++) {
    const lc = LAYER_COLORS[i] ?? LAYER_COLORS[0];
    const names = ["L0 UI", "L1 Business", "L2 Infra", "L3 Data"];
    const ltex = createTextTexture(names[i] ?? `L${i}`, 13, lc.css);
    const lbl = new THREE.Sprite(new THREE.SpriteMaterial({ map: ltex, transparent: true, opacity: 0.2 }));
    lbl.scale.set(5, 1, 1);
    lbl.position.set(-28, layerHeights[i], 0);
    scene.add(lbl);
  }

  // Beam lines
  for (let i = 0; i < (config.maxBeams ?? 50); i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const mat = new THREE.LineBasicMaterial({ color: PALETTE.mint.hex, transparent: true, opacity: 0 });
    scene.add(new THREE.Line(geo, mat));
  }

  // Resize handler
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    renderer, scene, camera, controls,
    cellMeshes, gridGroups, viewEngine, cellStates, beamPool,
    gridPositions, gridFloor, gridFloorSub: gridFloorSub,
  };
}

// ═══════════════════════════════════════════════════
//  Update Loop
// ═══════════════════════════════════════════════════

export function updateScene(state: SceneState, dt: number, time: number, settings: DisplaySettings, activeSet: ReadonlySet<string>): void {
  // View engine lerp
  state.viewEngine.update(dt);
  for (const [id, group] of state.gridGroups) {
    const pos = state.viewEngine.getPosition(id);
    if (pos) group.position.lerp(new THREE.Vector3(pos.x, pos.y, pos.z), dt * 3);
  }

  // Cell glow
  state.cellStates.decay(dt);
  for (const [key, cm] of state.cellMeshes) {
    const cellState = state.cellStates.getOrCreate(key);
    const isActive = activeSet.has(key);
    const pulse = isActive ? 0.4 + Math.sin(time * 5) * 0.2 : 0;
    const intensity = Math.max(cellState.glow, pulse);

    cm.material.emissive.setHex(cm.catColor.e);
    cm.material.emissiveIntensity = intensity * 3 * settings.glowMultiplier;
    cm.material.opacity = settings.baseOpacity + intensity * (1 - settings.baseOpacity);
    cm.edgeMaterial.opacity = settings.edgeOpacity + intensity * (1 - settings.edgeOpacity);
  }

  // Beam decay
  state.beamPool.decay(dt);

  // Controls
  state.controls.update();

  // Render
  state.renderer.render(state.scene, state.camera);
}

// ═══════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════

function createTextTexture(text: string, fontSize: number, color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 48;
  // eslint-disable-next-line typescript/no-non-null-assertion -- canvas 2d 컨텍스트 보장
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.font = `500 ${fontSize}px IBM Plex Mono, monospace`;
  ctx.textAlign = "center";
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

/** 셀의 월드 좌표를 계산 */
export function getCellWorldPosition(state: SceneState, key: string): THREE.Vector3 | null {
  const cm = state.cellMeshes.get(key);
  if (!cm) return null;
  const v = new THREE.Vector3();
  cm.mesh.getWorldPosition(v);
  return v;
}

/** Raycaster로 클릭된 셀 찾기 */
export function pickCell(state: SceneState, mouseX: number, mouseY: number): string | null {
  const mouse = new THREE.Vector2(
    (mouseX / window.innerWidth) * 2 - 1,
    -(mouseY / window.innerHeight) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, state.camera);

  const meshes = [...state.cellMeshes.values()].map(cm => cm.mesh);
  const hits = raycaster.intersectObjects(meshes);
  if (hits.length === 0) return null;

  for (const [key, cm] of state.cellMeshes) {
    if (cm.mesh === hits[0].object) return key;
  }
  return null;
}
