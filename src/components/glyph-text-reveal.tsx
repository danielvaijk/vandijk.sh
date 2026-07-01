import type { QwikJSX } from "@builder.io/qwik";
import { component$, useVisibleTask$ } from "@builder.io/qwik";

type GlyphTextRevealProps = {
  routeKey: string;
};

const GLYPH_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%&*+=-~.:;|/\\<>";
const REVEAL_DURATION_MS = 720;
const REVEAL_STAGGER_MS = 260;
const REVEAL_FRAME_RATE = 1000 / 24;
const REVEAL_CONTAINER_SELECTOR = [
  "article > *",
  "main > :not(article):not(section)",
  "section > *",
  "ul > li",
].join(",");
const HEADER_REVEAL_CONTAINER_SELECTOR = ["header > #header-name", "header nav li"].join(",");
const TEXT_EXCLUDED_SELECTOR = [
  "canvas",
  "code",
  "input",
  "kbd",
  "noscript",
  "option",
  "pre",
  "samp",
  "script",
  "select",
  "style",
  "svg",
  "textarea",
  "[data-glyph-text-reveal]",
].join(",");
const CONTENT_CONTAINER_EXCLUDED_SELECTOR = [
  TEXT_EXCLUDED_SELECTOR,
  "footer",
  "header",
  "nav",
].join(",");
const CODE_BLOCK_TEXT_EXCLUDED_SELECTOR = [
  "canvas",
  "input",
  "kbd",
  "noscript",
  "option",
  "samp",
  "script",
  "select",
  "style",
  "svg",
  "textarea",
  "[data-glyph-text-reveal]",
].join(",");
const revealedElements = new WeakSet<Element>();
const scannedContainers = new WeakSet<Element>();

type AnimatedGlyphToken = {
  isComplete: boolean;
  original: string;
  originalCharacters: string[];
  originalElement: HTMLSpanElement;
  overlay: HTMLSpanElement;
  overlayCharacters: string[];
  startOffset: number;
};

type ActiveGlyphReveal = {
  cancel: () => void;
  complete: () => void;
  lastFrameAt: number;
  render: (time: number) => boolean;
  startedAt: number;
};

type GlyphTextRevealTarget = {
  element: Element;
  textNodes: Text[];
};

type WrappedTextNode = {
  original: string;
  wrapper: HTMLSpanElement;
};

type AnimateTextNodesOptions = {
  excludedSelector?: string;
  restoreCompleted?: boolean;
};

const activeReveals = new Set<ActiveGlyphReveal>();
let sharedAnimationFrame = 0;
let randomSeed = Math.floor(Math.random() * 0xffffffff) || 1;

const randomUnit = (): number => {
  randomSeed ^= randomSeed << 13;
  randomSeed ^= randomSeed >>> 17;
  randomSeed ^= randomSeed << 5;

  return (randomSeed >>> 0) / 0x100000000;
};

const randomGlyph = (): string => GLYPH_CHARS[Math.floor(randomUnit() * GLYPH_CHARS.length)];

const shouldAnimateTextNode = (node: Text, excludedSelector = TEXT_EXCLUDED_SELECTOR): boolean => {
  const parent = node.parentElement;

  if (!parent || parent.closest(excludedSelector)) return false;

  return node.data.trim().length > 0;
};

const createScrambledCharacters = (characters: string[]): string[] =>
  characters.map((): string => randomGlyph());

const updateScrambledText = (token: AnimatedGlyphToken, progress: number): void => {
  if (progress >= 1) {
    token.overlay.textContent = token.original;
    return;
  }

  const revealCount = Math.floor(token.originalCharacters.length * progress);

  for (let index = 0; index < token.originalCharacters.length; index += 1) {
    token.overlayCharacters[index] =
      index < revealCount ? token.originalCharacters[index] : randomGlyph();
  }

  token.overlay.textContent = token.overlayCharacters.join("");
};

const createGlyphToken = (
  text: string,
): { element: HTMLSpanElement; token: AnimatedGlyphToken } => {
  const element = document.createElement("span");
  const original = document.createElement("span");
  const overlay = document.createElement("span");
  const originalCharacters = Array.from(text);
  const overlayCharacters = createScrambledCharacters(originalCharacters);

  element.dataset.glyphTextReveal = "";
  element.style.position = "relative";
  element.style.display = "inline-block";
  element.style.verticalAlign = "baseline";
  element.style.lineHeight = "inherit";

  original.textContent = text;
  original.style.color = "transparent";

  overlay.textContent = overlayCharacters.join("");
  overlay.ariaHidden = "true";
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.whiteSpace = "pre";

  element.append(original, overlay);

  return {
    element,
    token: {
      isComplete: false,
      original: text,
      originalCharacters,
      originalElement: original,
      overlay,
      overlayCharacters,
      startOffset: randomUnit() * REVEAL_STAGGER_MS,
    },
  };
};

const createRevealTargets = (
  root: Element,
  excludedSelector = TEXT_EXCLUDED_SELECTOR,
): GlyphTextRevealTarget[] => {
  const textNodesByElement = new Map<Element, Text[]>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node): number =>
      shouldAnimateTextNode(node as Text, excludedSelector)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  });

  let currentNode = walker.nextNode();
  while (currentNode) {
    const textNode = currentNode as Text;
    const parent = textNode.parentElement;

    if (parent && !revealedElements.has(parent)) {
      const textNodes = textNodesByElement.get(parent);

      if (textNodes) {
        textNodes.push(textNode);
      } else {
        textNodesByElement.set(parent, [textNode]);
      }
    }

    currentNode = walker.nextNode();
  }

  return Array.from(textNodesByElement, ([element, textNodes]) => ({ element, textNodes }));
};

const createRevealContainers = (
  root: HTMLElement,
  selector: string,
  excludedSelector: string,
): Element[] => {
  const containers = Array.from(root.querySelectorAll(selector)).filter(
    (element): boolean => !element.closest(excludedSelector),
  );

  return containers.length > 0 ? containers : [root];
};

const scheduleSharedAnimation = (): void => {
  if (sharedAnimationFrame !== 0 || activeReveals.size === 0) return;

  sharedAnimationFrame = requestAnimationFrame(renderActiveReveals);
};

const renderActiveReveals = (time: number): void => {
  sharedAnimationFrame = 0;

  for (const reveal of activeReveals) {
    if (reveal.startedAt === 0) reveal.startedAt = time;
    if (time - reveal.lastFrameAt < REVEAL_FRAME_RATE) continue;

    reveal.lastFrameAt = time;

    if (reveal.render(time)) {
      activeReveals.delete(reveal);
      reveal.complete();
    }
  }

  scheduleSharedAnimation();
};

const animateTextNodes = (
  textNodes: Text[],
  {
    excludedSelector = TEXT_EXCLUDED_SELECTOR,
    restoreCompleted = true,
  }: AnimateTextNodesOptions = {},
): (() => void) => {
  const tokens: AnimatedGlyphToken[] = [];
  const wrappedTextNodes: WrappedTextNode[] = [];

  for (const textNode of textNodes) {
    if (!textNode.isConnected || !shouldAnimateTextNode(textNode, excludedSelector)) continue;

    const original = textNode.data;
    const wrapper = document.createElement("span");
    const fragment = document.createDocumentFragment();

    wrapper.dataset.glyphTextReveal = "";

    for (const part of original.split(/(\s+)/u)) {
      if (part.length === 0) continue;

      if (/^\s+$/u.test(part)) {
        fragment.append(document.createTextNode(part));
        continue;
      }

      const { element, token } = createGlyphToken(part);
      tokens.push(token);
      fragment.append(element);
    }

    wrapper.append(fragment);
    textNode.replaceWith(wrapper);
    wrappedTextNodes.push({ original, wrapper });
  }

  if (tokens.length === 0) return (): void => {};

  let isCleanedUp = false;

  const restoreTextNodes = (): void => {
    if (isCleanedUp) return;
    isCleanedUp = true;

    for (const { original, wrapper } of wrappedTextNodes) {
      wrapper.replaceWith(document.createTextNode(original));
    }
  };

  const completeReveal = (): void => {
    if (isCleanedUp) return;

    for (const { originalElement, overlay } of tokens) {
      originalElement.style.color = "";
      overlay.remove();
    }

    if (!restoreCompleted) {
      isCleanedUp = true;
    }
  };

  const reveal: ActiveGlyphReveal = {
    cancel: restoreTextNodes,
    complete: completeReveal,
    lastFrameAt: 0,
    render: (time: number): boolean => {
      let isComplete = true;

      for (const token of tokens) {
        if (token.isComplete) continue;

        const progress = Math.min(
          1,
          (time - reveal.startedAt - token.startOffset) / REVEAL_DURATION_MS,
        );

        if (progress < 1) {
          isComplete = false;
          updateScrambledText(token, Math.max(0, progress));
        } else {
          token.overlay.textContent = token.original;
          token.isComplete = true;
        }
      }

      return isComplete;
    },
    startedAt: 0,
  };

  activeReveals.add(reveal);
  scheduleSharedAnimation();

  return (): void => {
    activeReveals.delete(reveal);
    restoreTextNodes();
  };
};

export const GlyphTextReveal = component$(({ routeKey }: GlyphTextRevealProps): QwikJSX.Element => {
  useVisibleTask$(({ cleanup, track }): void => {
    track(() => routeKey);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.body;
    if (!root || prefersReducedMotion) return;

    const restoreAnimations = new Set<() => void>();
    const targetsByElement = new Map<Element, { restoreCompleted: boolean; textNodes: Text[] }>();
    const observedRevealTargets = new WeakSet<Element>();
    const targetObserver = new IntersectionObserver(
      (entries): void => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const target = entry.target as Element;
          const targetData = targetsByElement.get(target);
          if (!targetData) continue;

          targetObserver.unobserve(target);
          targetsByElement.delete(target);
          revealedElements.add(target);

          const restoreAnimation = animateTextNodes(targetData.textNodes, {
            restoreCompleted: targetData.restoreCompleted,
          });
          restoreAnimations.add(restoreAnimation);
        }
      },
      { threshold: 0.01 },
    );
    const observeContainerTargets = ({
      container,
      excludedSelector = TEXT_EXCLUDED_SELECTOR,
      restoreCompleted = true,
    }: {
      container: Element;
      excludedSelector?: string;
      restoreCompleted?: boolean;
    }): void => {
      if (scannedContainers.has(container)) return;
      scannedContainers.add(container);

      for (const { element, textNodes } of createRevealTargets(container, excludedSelector)) {
        if (observedRevealTargets.has(element) || revealedElements.has(element)) continue;

        observedRevealTargets.add(element);
        targetsByElement.set(element, { restoreCompleted, textNodes });
        targetObserver.observe(element);
      }
    };
    const drawerCodeRevealCleanups = new Map<HTMLDetailsElement, () => void>();
    const revealedCodeDrawers = new WeakSet<HTMLDetailsElement>();
    const drawerToggleCleanups = new Set<() => void>();
    const revealDrawerCode = (drawer: HTMLDetailsElement): void => {
      if (!drawer.open || revealedCodeDrawers.has(drawer)) return;

      revealedCodeDrawers.add(drawer);

      const textNodes = Array.from(drawer.querySelectorAll("pre")).flatMap((codeBlock) =>
        createRevealTargets(codeBlock, CODE_BLOCK_TEXT_EXCLUDED_SELECTOR).flatMap(
          (target): Text[] => target.textNodes,
        ),
      );
      const cleanupReveal = animateTextNodes(textNodes, {
        excludedSelector: CODE_BLOCK_TEXT_EXCLUDED_SELECTOR,
      });

      drawerCodeRevealCleanups.set(drawer, cleanupReveal);
    };
    const codeDrawers = Array.from(
      root.querySelectorAll<HTMLDetailsElement>(".article-code-drawer"),
    );

    for (const drawer of codeDrawers) {
      const handleToggle = (): void => revealDrawerCode(drawer);

      drawer.addEventListener("toggle", handleToggle);
      drawerToggleCleanups.add((): void => drawer.removeEventListener("toggle", handleToggle));
    }
    const containerObserver = new IntersectionObserver(
      (entries): void => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const container = entry.target;
          containerObserver.unobserve(container);
          observeContainerTargets({
            container,
            excludedSelector: CONTENT_CONTAINER_EXCLUDED_SELECTOR,
          });
        }
      },
      { rootMargin: "200px 0px", threshold: 0.01 },
    );
    const containers = createRevealContainers(
      root,
      REVEAL_CONTAINER_SELECTOR,
      CONTENT_CONTAINER_EXCLUDED_SELECTOR,
    );

    for (const container of containers) {
      containerObserver.observe(container);
    }

    for (const container of root.querySelectorAll(HEADER_REVEAL_CONTAINER_SELECTOR)) {
      observeContainerTargets({ container, restoreCompleted: false });
    }

    cleanup(() => {
      containerObserver.disconnect();
      targetObserver.disconnect();

      for (const restoreAnimation of restoreAnimations) {
        restoreAnimation();
      }

      for (const cleanupDrawerReveal of drawerCodeRevealCleanups.values()) {
        cleanupDrawerReveal();
      }

      for (const cleanupDrawerToggle of drawerToggleCleanups) {
        cleanupDrawerToggle();
      }
    });
  });

  return <></>;
});
