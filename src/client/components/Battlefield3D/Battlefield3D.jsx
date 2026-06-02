"use client";

import * as React from "react";
import * as THREE from "three";
import { cardImageSrc, currentOpponent, normalizeRarity, rarityLabel, sortCardsByRarity } from "../../ui.js";
import styles from "./Battlefield3D.module.css";

const CARD_WIDTH = 1.02;
const CARD_HEIGHT = 1.52;
const CARD_DEPTH = 0.035;
const FIELD_CARD_SCALE = 1.12;
const HAND_CARD_SCALE = 0.78;
const MAX_HAND_CARDS = 8;
const BASE_CAMERA_POSITION = new THREE.Vector3(0, 4.6, 5.55);
const ZOOM_CAMERA_POSITION = new THREE.Vector3(0, 2.65, 2.85);
const CAMERA_TARGET = new THREE.Vector3(0, 0.18, 0);
const REVEAL_DURATION_MS = 2850;
const CARD_BACK_KEY = "__card_back";
const BOARD_TEXTURE_KEY = "__board";
const LABEL_TEXTURE_PREFIX = "__label:";

const rarityColors = {
  comune: 0x8b8b84,
  rara: 0x3496ff,
  epica: 0xa855f7,
  leggendaria: 0xd6ae52,
  mitica: 0xe45b3f,
  speciale: 0xd6ae52
};

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function easeInOut(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    for (const item of material) {
      item.dispose();
    }
    return;
  }

  material?.dispose();
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      disposeMaterial(child.material);
    }
  });
}

function clearGroup(group) {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeObject(child);
  }
}

function drawRoundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function createCanvasTexture(key, width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (context) {
    draw(context, width, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.name = key;

  return texture;
}

function getCardBackTexture(context) {
  if (context.textures.has(CARD_BACK_KEY)) {
    return context.textures.get(CARD_BACK_KEY);
  }

  const texture = createCanvasTexture(CARD_BACK_KEY, 512, 768, (canvasContext, width, height) => {
    const gradient = canvasContext.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#211a0b");
    gradient.addColorStop(0.42, "#0b120f");
    gradient.addColorStop(1, "#3b2a0c");
    canvasContext.fillStyle = gradient;
    canvasContext.fillRect(0, 0, width, height);

    canvasContext.strokeStyle = "#d6ae52";
    canvasContext.lineWidth = 16;
    drawRoundedRect(canvasContext, 28, 28, width - 56, height - 56, 42);
    canvasContext.stroke();

    canvasContext.strokeStyle = "rgba(214, 174, 82, 0.45)";
    canvasContext.lineWidth = 5;
    for (let offset = -height; offset < width; offset += 54) {
      canvasContext.beginPath();
      canvasContext.moveTo(offset, height);
      canvasContext.lineTo(offset + height, 0);
      canvasContext.stroke();
    }

    canvasContext.fillStyle = "#f4f0df";
    canvasContext.font = "900 176px Inter, Arial, sans-serif";
    canvasContext.textAlign = "center";
    canvasContext.textBaseline = "middle";
    canvasContext.fillText("V", width / 2, height / 2 - 18);

    canvasContext.fillStyle = "#d6ae52";
    canvasContext.font = "900 34px Inter, Arial, sans-serif";
    canvasContext.fillText("VALEVERCE", width / 2, height / 2 + 104);
  });

  context.textures.set(CARD_BACK_KEY, texture);
  return texture;
}

function getBoardTexture(context) {
  if (context.textures.has(BOARD_TEXTURE_KEY)) {
    return context.textures.get(BOARD_TEXTURE_KEY);
  }

  const texture = createCanvasTexture(BOARD_TEXTURE_KEY, 1024, 512, (canvasContext, width, height) => {
    const gradient = canvasContext.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, width / 1.8);
    gradient.addColorStop(0, "#30402f");
    gradient.addColorStop(0.58, "#151c15");
    gradient.addColorStop(1, "#070807");
    canvasContext.fillStyle = gradient;
    canvasContext.fillRect(0, 0, width, height);

    canvasContext.strokeStyle = "rgba(214, 174, 82, 0.22)";
    canvasContext.lineWidth = 3;
    for (let x = 60; x < width; x += 72) {
      canvasContext.beginPath();
      canvasContext.moveTo(x, 0);
      canvasContext.lineTo(width - x * 0.2, height);
      canvasContext.stroke();
    }

    canvasContext.strokeStyle = "rgba(244, 240, 223, 0.08)";
    canvasContext.lineWidth = 8;
    drawRoundedRect(canvasContext, 38, 38, width - 76, height - 76, 40);
    canvasContext.stroke();
  });

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.25, 1);
  context.textures.set(BOARD_TEXTURE_KEY, texture);
  return texture;
}

function getLabelTexture(context, text, tone = "gold") {
  const key = `${LABEL_TEXTURE_PREFIX}${tone}:${text}`;
  if (context.textures.has(key)) {
    return context.textures.get(key);
  }

  const toneColor = tone === "trap" ? "#d06f9f" : tone === "utility" ? "#4dbf9e" : tone === "muted" ? "#9b9b8f" : "#d6ae52";
  const texture = createCanvasTexture(key, 512, 128, (canvasContext, width, height) => {
    canvasContext.clearRect(0, 0, width, height);
    canvasContext.fillStyle = "rgba(7, 8, 7, 0.74)";
    drawRoundedRect(canvasContext, 8, 18, width - 16, height - 36, 22);
    canvasContext.fill();
    canvasContext.strokeStyle = toneColor;
    canvasContext.lineWidth = 4;
    canvasContext.stroke();
    canvasContext.fillStyle = "#f4f0df";
    canvasContext.font = "900 34px Inter, Arial, sans-serif";
    canvasContext.textAlign = "center";
    canvasContext.textBaseline = "middle";
    canvasContext.fillText(text, width / 2, height / 2);
  });

  context.textures.set(key, texture);
  return texture;
}

function getCardTexture(context, card) {
  if (!card?.id) {
    return null;
  }

  const key = `card:${card.id}`;
  if (context.textures.has(key)) {
    return context.textures.get(key);
  }

  const texture = context.loader.load(cardImageSrc(card));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = context.renderer.capabilities.getMaxAnisotropy();
  context.textures.set(key, texture);

  return texture;
}

function rarityColor(card) {
  return rarityColors[normalizeRarity(card?.rarity)] ?? rarityColors.comune;
}

function makeCardMaterial(context, card, faceUp) {
  const texture = faceUp ? getCardTexture(context, card) : getCardBackTexture(context);
  const color = faceUp ? 0xffffff : 0xd6ae52;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color,
    roughness: 0.54,
    metalness: 0.08,
    side: THREE.DoubleSide
  });

  material.userData.frontTexture = getCardTexture(context, card);
  material.userData.backTexture = getCardBackTexture(context);

  return material;
}

function addTextPlane(context, group, text, { x, y, z, width = 1.58, height = 0.38, tone = "gold" }) {
  const texture = getLabelTexture(context, text, tone);
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.x = -Math.PI / 2;
  group.add(mesh);

  return mesh;
}

function addSlot(context, { x, z, color = 0xd6ae52, label }) {
  const ringGeometry = new THREE.RingGeometry(0.66, 0.72, 72);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.set(x, 0.025, z);
  ring.rotation.x = -Math.PI / 2;
  context.dynamicGroup.add(ring);

  if (label) {
    addTextPlane(context, context.dynamicGroup, label, {
      x,
      y: 0.04,
      z: z + 0.84,
      width: 1.28,
      height: 0.28,
      tone: "muted"
    });
  }
}

function addCard(context, {
  card,
  label = "",
  x,
  y = 0.86,
  z,
  scale = 1,
  faceUp = true,
  selected = false,
  disabled = false,
  clickableKind = "card",
  reveal = false,
  rotationY = 0
}) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotationY;
  group.scale.setScalar(scale);
  group.userData.basePosition = group.position.clone();
  group.userData.baseRotationY = rotationY;
  group.userData.baseScale = scale;
  group.userData.reveal = reveal;
  group.userData.card = card;

  const normalizedColor = rarityColor(card);
  const bodyGeometry = new THREE.BoxGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_DEPTH);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: selected ? normalizedColor : 0x10120f,
    roughness: 0.48,
    metalness: selected ? 0.18 : 0.08
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const faceGeometry = new THREE.PlaneGeometry(CARD_WIDTH * 0.96, CARD_HEIGHT * 0.96);
  const faceMaterial = makeCardMaterial(context, card, faceUp);
  const face = new THREE.Mesh(faceGeometry, faceMaterial);
  face.position.z = CARD_DEPTH / 2 + 0.003;
  face.castShadow = true;
  face.userData.kind = clickableKind;
  face.userData.card = card;
  face.userData.cardId = card?.id ?? "";
  face.userData.disabled = disabled;
  group.add(face);
  context.clickable.push(face);

  if (selected) {
    const glowGeometry = new THREE.PlaneGeometry(CARD_WIDTH * 1.16, CARD_HEIGHT * 1.16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: normalizedColor,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.z = CARD_DEPTH / 2 - 0.002;
    group.add(glow);
  }

  if (label) {
    addTextPlane(context, group, label, {
      x: 0,
      y: -CARD_HEIGHT / 2 - 0.18,
      z: CARD_DEPTH / 2 + 0.01,
      width: 1.16,
      height: 0.24,
      tone: faceUp ? "gold" : "muted"
    });
    group.children[group.children.length - 1].rotation.x = 0;
  }

  context.dynamicGroup.add(group);
  if (reveal) {
    context.revealCards.push({ group, face, material: faceMaterial, color: normalizedColor });
  }

  return group;
}

function addPile(context, { x, z, count = 0, label, tone = "gold", hidden = true }) {
  const visibleCount = Math.max(1, Math.min(5, Number(count ?? 0)));
  const backTexture = getCardBackTexture(context);
  for (let index = 0; index < visibleCount; index += 1) {
    const geometry = new THREE.BoxGeometry(0.58, 0.86, 0.026);
    const material = new THREE.MeshStandardMaterial({
      map: hidden ? backTexture : null,
      color: hidden ? 0xffffff : 0x151711,
      roughness: 0.62,
      metalness: 0.05
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x + index * 0.025, 0.13 + index * 0.022, z - index * 0.018);
    mesh.rotation.x = -0.24;
    mesh.rotation.z = index * 0.015;
    mesh.castShadow = true;
    context.dynamicGroup.add(mesh);
  }

  addTextPlane(context, context.dynamicGroup, `${label} ${count ?? 0}`, {
    x,
    y: 0.035,
    z: z + 0.62,
    width: 1.24,
    height: 0.28,
    tone
  });
}

function addBoard(context) {
  const boardGeometry = new THREE.BoxGeometry(7.4, 0.22, 4.4);
  const boardMaterial = new THREE.MeshStandardMaterial({
    map: getBoardTexture(context),
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0.04
  });
  const board = new THREE.Mesh(boardGeometry, boardMaterial);
  board.position.set(0, -0.15, 0);
  board.receiveShadow = true;
  context.staticGroup.add(board);

  const trimGeometry = new THREE.BoxGeometry(7.65, 0.12, 4.65);
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a2b12,
    roughness: 0.45,
    metalness: 0.22
  });
  const trim = new THREE.Mesh(trimGeometry, trimMaterial);
  trim.position.set(0, -0.26, 0);
  trim.receiveShadow = true;
  context.staticGroup.add(trim);
}

function addLighting(scene) {
  const ambient = new THREE.HemisphereLight(0xf4f0df, 0x070807, 1.7);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff1c7, 2.25);
  key.position.set(-2.4, 5.4, 4.2);
  key.castShadow = true;
  key.shadow.mapSize.width = 1024;
  key.shadow.mapSize.height = 1024;
  scene.add(key);

  const rim = new THREE.PointLight(0x4dbf9e, 1.4, 8);
  rim.position.set(3.2, 1.8, -2.8);
  scene.add(rim);

  const cinematicLight = new THREE.PointLight(0xd6ae52, 0, 7);
  cinematicLight.position.set(0, 1.7, 0.4);
  scene.add(cinematicLight);

  return cinematicLight;
}

function fieldCardState(lobby, selectedCardId, phase) {
  const self = lobby?.self ?? null;
  const opponent = currentOpponent(lobby);
  const selectedFromHand = selectedCardId ? self?.deck?.find((card) => card.id === selectedCardId) : null;
  const selfSelectedCard = self?.selected?.selectedCard ?? selectedFromHand ?? null;
  const opponentCard = opponent?.selectedCard ?? opponent?.selected?.selectedCard ?? null;
  const selfHasHiddenCard = Boolean(phase === "select" && (self?.selected?.cardId || selectedCardId));
  const opponentHasHiddenCard = Boolean(opponent?.hasSelected && !opponentCard);

  return {
    self,
    opponent,
    selfCard: selfSelectedCard,
    selfFaceUp: Boolean(selfSelectedCard && phase !== "select"),
    selfHidden: Boolean(selfHasHiddenCard && selfSelectedCard),
    opponentCard,
    opponentFaceUp: Boolean(opponentCard),
    opponentHidden: opponentHasHiddenCard
  };
}

function handCardsForPhase(lobby, phase) {
  const self = lobby?.self ?? null;
  if (!self) {
    return [];
  }

  if (phase === "select") {
    return sortCardsByRarity(self.deck ?? []).slice(0, MAX_HAND_CARDS);
  }

  if (lobby?.effectWindow?.status === "waiting") {
    return (self.utilityHand ?? []).slice(0, MAX_HAND_CARDS);
  }

  return [];
}

function effectSubmissionCard(player, submission) {
  if (!submission?.cardId) {
    return null;
  }

  return [...(player?.utilityDiscard ?? []), ...(player?.armedTraps ?? []).map((trap) => trap.card).filter(Boolean)]
    .find((card) => card?.id === submission.cardId) ?? null;
}

function rebuildScene(context, props) {
  clearGroup(context.dynamicGroup);
  context.clickable = [];
  context.revealCards = [];

  const { lobby, selectedCardId, phase } = props;
  const state = fieldCardState(lobby, selectedCardId, phase);
  const effectWindow = lobby?.effectWindow;
  const revealActive = Boolean(phase === "reveal" && lobby?.lastResult);
  const selectedCardIds = new Set([selectedCardId, state.self?.selected?.cardId].filter(Boolean));

  addSlot(context, { x: 0, z: -0.82, color: 0xe05b56, label: state.opponent?.name ?? "Avversario" });
  addSlot(context, { x: 0, z: 0.92, color: 0x4d9cff, label: "Tu" });

  if (state.opponentCard) {
    addCard(context, {
      card: state.opponentCard,
      label: revealActive ? rarityLabel(state.opponentCard.rarity) : state.opponentCard.name,
      x: 0,
      z: -0.82,
      faceUp: state.opponentFaceUp && !revealActive,
      scale: FIELD_CARD_SCALE,
      clickableKind: "field",
      reveal: revealActive
    });
  } else if (state.opponentHidden) {
    addCard(context, {
      card: { id: "opponent-hidden", name: "Carta coperta", rarity: "comune" },
      label: "Coperta",
      x: 0,
      z: -0.82,
      faceUp: false,
      scale: FIELD_CARD_SCALE,
      disabled: true,
      clickableKind: "hidden"
    });
  }

  if (state.selfCard) {
    addCard(context, {
      card: state.selfCard,
      label: state.selfFaceUp ? state.selfCard.name : "Coperta",
      x: 0,
      z: 0.92,
      faceUp: state.selfFaceUp && !revealActive,
      selected: selectedCardIds.has(state.selfCard.id),
      scale: FIELD_CARD_SCALE,
      clickableKind: phase === "select" ? "hand" : "field",
      reveal: revealActive
    });
  } else if (state.selfHidden) {
    addCard(context, {
      card: { id: "self-hidden", name: "Carta coperta", rarity: "comune" },
      label: "Coperta",
      x: 0,
      z: 0.92,
      faceUp: false,
      scale: FIELD_CARD_SCALE,
      disabled: true,
      clickableKind: "hidden"
    });
  }

  addPile(context, {
    x: -3.15,
    z: -1.55,
    count: state.opponent?.utilityDrawCount ?? 0,
    label: "U deck",
    tone: "muted"
  });
  addPile(context, {
    x: -2.28,
    z: -1.55,
    count: state.opponent?.utilityDiscardCount ?? 0,
    label: "Scarti",
    tone: "muted",
    hidden: false
  });
  addPile(context, {
    x: 3.15,
    z: -1.55,
    count: state.opponent?.armedTrapCount ?? state.opponent?.armedTraps?.length ?? 0,
    label: "Trap",
    tone: "trap"
  });
  addPile(context, {
    x: -3.15,
    z: 1.45,
    count: state.self?.utilityDrawCount ?? 0,
    label: "U deck",
    tone: "utility"
  });
  addPile(context, {
    x: -2.28,
    z: 1.45,
    count: state.self?.utilityDiscard?.length ?? state.self?.utilityDiscardCount ?? 0,
    label: "Scarti",
    tone: "utility",
    hidden: false
  });
  addPile(context, {
    x: 3.15,
    z: 1.45,
    count: state.self?.armedTraps?.length ?? state.self?.armedTrapCount ?? 0,
    label: "Trap",
    tone: "trap"
  });

  const queueEntries = effectWindow?.submissions ? Object.entries(effectWindow.submissions).slice(0, 2) : [];
  queueEntries.forEach(([playerId, submission], index) => {
    const isSelf = playerId === state.self?.id;
    const publicPlayer = lobby.players.find((player) => player.id === playerId);
    const player = isSelf ? { ...publicPlayer, ...state.self } : publicPlayer;
    const card = isSelf ? effectSubmissionCard(player, submission) : null;
    const x = -0.48 + index * 0.96;

    addCard(context, {
      card: card ?? { id: `queue-${playerId}`, name: submission.type === "pass" ? "Pass" : "Carta coperta", rarity: "comune" },
      label: submission.type === "pass" ? "Pass" : "Coda",
      x,
      y: 0.56,
      z: 0,
      scale: 0.48,
      faceUp: Boolean(card || submission.type === "pass"),
      disabled: true,
      clickableKind: "queue"
    });
  });

  const handCards = handCardsForPhase(lobby, phase);
  const handSpread = Math.min(5.7, Math.max(0, (handCards.length - 1) * 0.72));
  handCards.forEach((card, index) => {
    const ratio = handCards.length <= 1 ? 0 : index / (handCards.length - 1);
    const x = -handSpread / 2 + ratio * handSpread;
    const selected = selectedCardIds.has(card.id);
    const disabled = phase === "select" && (!state.self?.isActive || Number(state.self?.cooldowns?.[card.id] ?? 0) > 0 || Boolean(state.self?.selected?.cardId));
    const fan = (ratio - 0.5) * 0.34;

    addCard(context, {
      card,
      label: selected ? "Scelta" : "",
      x,
      y: selected ? 0.78 : 0.58,
      z: 2.24 + Math.abs(ratio - 0.5) * 0.18,
      scale: selected ? HAND_CARD_SCALE * 1.08 : HAND_CARD_SCALE,
      faceUp: true,
      selected,
      disabled,
      rotationY: fan,
      clickableKind: lobby?.effectWindow?.status === "waiting" ? "utility" : "hand"
    });
  });

  addTextPlane(context, context.dynamicGroup, effectWindow?.status === "waiting" ? "Finestra effetti" : "Campo 3D", {
    x: 0,
    y: 0.04,
    z: -2.04,
    width: 1.72,
    height: 0.32,
    tone: effectWindow?.status === "waiting" ? "utility" : "gold"
  });

  const revealKey = revealActive ? `${lobby.id}:${lobby.round}:${lobby.lastResult?.round}:${context.revealCards.length}` : "";
  if (revealKey && revealKey !== context.revealKey) {
    context.revealKey = revealKey;
    context.reveal = {
      start: performance.now(),
      cards: context.revealCards
    };
  } else if (!revealKey) {
    context.reveal = null;
    context.revealKey = "";
  }
}

function updateReveal(context, now) {
  if (!context.reveal) {
    context.camera.position.lerp(BASE_CAMERA_POSITION, 0.075);
    context.camera.lookAt(CAMERA_TARGET);
    context.cinematicLight.intensity += (0 - context.cinematicLight.intensity) * 0.12;
    return;
  }

  const elapsed = now - context.reveal.start;
  const progress = Math.max(0, Math.min(1, elapsed / REVEAL_DURATION_MS));
  const zoomProgress = progress < 0.28 ? easeInOut(progress / 0.28) : progress > 0.72 ? 1 - easeInOut((progress - 0.72) / 0.28) : 1;
  const flipProgress = easeInOut(Math.max(0, Math.min(1, (progress - 0.2) / 0.48)));
  const lift = Math.sin(Math.PI * Math.max(0, Math.min(1, (progress - 0.12) / 0.7)));
  const shake = progress > 0.45 && progress < 0.62 ? Math.sin(progress * 96) * 0.026 : 0;

  context.camera.position.lerpVectors(BASE_CAMERA_POSITION, ZOOM_CAMERA_POSITION, zoomProgress);
  context.camera.position.x += shake;
  context.camera.lookAt(CAMERA_TARGET);
  context.cinematicLight.intensity = 3.3 * Math.sin(Math.PI * progress);

  for (const item of context.reveal.cards) {
    const { group, material, color } = item;
    const basePosition = group.userData.basePosition;
    const baseRotationY = Number(group.userData.baseRotationY ?? 0);
    const baseScale = Number(group.userData.baseScale ?? 1);

    group.position.y = basePosition.y + lift * 0.72;
    group.rotation.y = baseRotationY + Math.PI * flipProgress;
    group.scale.setScalar(baseScale * (1 + Math.sin(Math.PI * progress) * 0.09));

    if (flipProgress > 0.5 && material.map !== material.userData.frontTexture) {
      material.map = material.userData.frontTexture;
      material.color.set(0xffffff);
      material.emissive = new THREE.Color(color);
      material.emissiveIntensity = 0.18;
      material.needsUpdate = true;
    }

    if (progress >= 1) {
      group.position.copy(basePosition);
      group.rotation.y = baseRotationY;
      group.scale.setScalar(baseScale);
      material.map = material.userData.frontTexture;
      material.color.set(0xffffff);
      material.emissiveIntensity = 0;
      material.needsUpdate = true;
    }
  }

  if (progress >= 1) {
    context.reveal = null;
  }
}

function createContext(mount, onError) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = styles.canvas;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070807);
  scene.fog = new THREE.Fog(0x070807, 6.6, 11.5);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.copy(BASE_CAMERA_POSITION);
  camera.lookAt(CAMERA_TARGET);

  const staticGroup = new THREE.Group();
  const dynamicGroup = new THREE.Group();
  scene.add(staticGroup);
  scene.add(dynamicGroup);

  const context = {
    renderer,
    scene,
    camera,
    staticGroup,
    dynamicGroup,
    loader: new THREE.TextureLoader(),
    textures: new Map(),
    clickable: [],
    revealCards: [],
    raycaster: new THREE.Raycaster(),
    pointer: new THREE.Vector2(),
    frameId: 0,
    resizeObserver: null,
    reveal: null,
    revealKey: "",
    cinematicLight: addLighting(scene)
  };

  try {
    addBoard(context);
  } catch (error) {
    onError(error);
  }

  return context;
}

export function Battlefield3D({
  lobby,
  selectedCardId = "",
  previewCard = null,
  phase = lobby?.phase,
  className = "",
  onSelectCard = undefined,
  onPreviewCard = undefined,
  onPlayUtility = undefined,
  fallback = null
}) {
  const mountRef = React.useRef(null);
  const contextRef = React.useRef(null);
  /** @type {React.MutableRefObject<any>} */
  const propsRef = React.useRef({});
  const [failed, setFailed] = React.useState(false);

  propsRef.current = {
    lobby,
    selectedCardId,
    previewCard,
    phase,
    className,
    onSelectCard,
    onPreviewCard,
    onPlayUtility
  };

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount || contextRef.current) {
      return undefined;
    }

    let disposed = false;

    try {
      const context = createContext(mount, () => setFailed(true));
      contextRef.current = context;

      const resize = () => {
        const width = Math.max(320, mount.clientWidth || 320);
        const height = Math.max(260, mount.clientHeight || 260);
        context.renderer.setSize(width, height, false);
        context.camera.aspect = width / height;
        context.camera.updateProjectionMatrix();
      };

      const handlePointerDown = (event) => {
        const currentContext = contextRef.current;
        if (!currentContext || !propsRef.current.lobby) {
          return;
        }

        const rect = currentContext.renderer.domElement.getBoundingClientRect();
        currentContext.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        currentContext.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        currentContext.raycaster.setFromCamera(currentContext.pointer, currentContext.camera);

        const hits = currentContext.raycaster.intersectObjects(currentContext.clickable, false);
        const hit = hits.find((item) => item.object?.userData?.card);
        if (!hit) {
          return;
        }

        const { card, cardId, kind, disabled } = hit.object.userData;
        if (disabled || !cardId) {
          return;
        }

        if (kind === "hand" && propsRef.current.phase === "select") {
          propsRef.current.onSelectCard?.(cardId);
          return;
        }

        if (kind === "utility") {
          propsRef.current.onPlayUtility?.(cardId);
          propsRef.current.onPreviewCard?.(card);
          return;
        }

        propsRef.current.onPreviewCard?.(card);
      };

      const animate = (now) => {
        if (disposed) {
          return;
        }

        updateReveal(context, now);
        context.renderer.render(context.scene, context.camera);
        context.frameId = window.requestAnimationFrame(animate);
      };

      context.resizeObserver = new ResizeObserver(resize);
      context.resizeObserver.observe(mount);
      resize();
      rebuildScene(context, propsRef.current);
      context.renderer.domElement.addEventListener("pointerdown", handlePointerDown);
      context.frameId = window.requestAnimationFrame(animate);

      return () => {
        disposed = true;
        window.cancelAnimationFrame(context.frameId);
        context.renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
        context.resizeObserver?.disconnect();
        clearGroup(context.dynamicGroup);
        clearGroup(context.staticGroup);
        for (const texture of context.textures.values()) {
          texture.dispose();
        }
        context.renderer.dispose();
        context.renderer.domElement.remove();
        contextRef.current = null;
      };
    } catch (error) {
      setFailed(true);
      return undefined;
    }
  }, []);

  React.useEffect(() => {
    const context = contextRef.current;
    if (!context || failed) {
      return;
    }

    rebuildScene(context, propsRef.current);
  }, [failed, lobby, phase, previewCard, selectedCardId]);

  const opponent = currentOpponent(lobby);
  const self = lobby?.self ?? null;

  return (
    <section className={classNames(styles.root, className, failed && styles.failed)} data-battlefield-3d>
      <div ref={mountRef} className={styles.stage} aria-hidden={failed ? "true" : undefined} />
      {!failed ? (
        <div className={styles.hud}>
          <div className={styles.playerBadge}>
            <span>{opponent?.name ?? "Avversario"}</span>
            <b>{opponent?.health ?? 0} PV · {opponent?.mana ?? 0} M</b>
          </div>
          <div className={styles.phaseBadge}>
            <span>3D board</span>
            <b>{phase ?? "-"}</b>
          </div>
          <div className={classNames(styles.playerBadge, styles.selfBadge)}>
            <span>{self?.name ?? "Tu"}</span>
            <b>{self?.health ?? 0} PV · {self?.mana ?? 0} M</b>
          </div>
        </div>
      ) : null}
      {failed ? (
        <div className={styles.fallback}>
          <strong>WebGL non disponibile.</strong>
          <span>Uso la UI classica.</span>
          {fallback}
        </div>
      ) : null}
    </section>
  );
}
